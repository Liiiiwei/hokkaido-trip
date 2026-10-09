import { DATA_REPO } from './config'
import { StoreError, type ErrorCode } from './errors'
import type { TripData } from './types'
import { parseTripData } from './validate'

export { StoreError, type ErrorCode }

// etag 用來問 GitHub「和上次一樣嗎」；一樣時回 304，不佔 API 額度
export type Snapshot = { data: TripData; sha: string; etag?: string | null }

const API = `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}/contents/${DATA_REPO.path}`
const MAX_ATTEMPTS = 5
const TIMEOUT_MS = 10_000
const RETRY_STEP_MS = 300

function headers(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

// 資料 → JSON → UTF-8 → base64（GitHub 檔案 API 要的格式）
export function encodeContent(data: TripData): string {
  const bytes = new TextEncoder().encode(`${JSON.stringify(data, null, 2)}\n`)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

export function decodeContent(base64: string): TripData {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new StoreError('bad_data')
  }
  return parseTripData(value)
}

function codeOf(res: Response): ErrorCode {
  const status = res.status
  if (status === 401 || status === 404) return 'bad_key'
  if (status === 409 || status === 422) return 'conflict'
  if (status === 429) return 'busy'
  if (status === 403) {
    // 額度用完也是 403，靠標頭分辨；其餘的 403 是權杖沒有寫入權限
    const limited =
      res.headers.get('x-ratelimit-remaining') === '0' || res.headers.has('retry-after')
    return limited ? 'busy' : 'read_only'
  }
  return 'network'
}

async function call(fetchFn: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    // 訊號差時最多等 10 秒，不讓後面排隊的讀寫全部卡住
    res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new StoreError('network')
  }
  // 304 是「和上次一樣」，由呼叫端處理
  if (!res.ok && res.status !== 304) throw new StoreError(codeOf(res))
  return res
}

// GitHub API 的回應預設會被瀏覽器快取 60 秒，所以一律不走快取。
// cached 是上次讀到的結果：帶著它的 etag 去問，沒變就直接沿用
export async function readFile(
  key: string,
  fetchFn: typeof fetch = fetch,
  cached?: Snapshot,
): Promise<Snapshot> {
  const res = await call(fetchFn, `${API}?ref=${DATA_REPO.branch}`, {
    headers: cached?.etag ? { ...headers(key), 'If-None-Match': cached.etag } : headers(key),
    cache: 'no-store',
  })
  if (res.status === 304 && cached) return cached
  const body = (await res.json()) as { content: string; sha: string }
  return { data: decodeContent(body.content), sha: body.sha, etag: res.headers.get('etag') }
}

// sha 是讀到的版本代號；這段時間有別人存過，GitHub 會拒絕
export async function writeFile(
  key: string,
  data: TripData,
  sha: string,
  message: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  await call(fetchFn, API, {
    method: 'PUT',
    headers: { ...headers(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeContent(data),
      sha,
      branch: DATA_REPO.branch,
    }),
  })
}

export type Io = {
  read: () => Promise<Snapshot>
  write: (data: TripData, sha: string, message: string) => Promise<void>
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// 抓最新版、套上修改、存回去；被搶先就等一下、重抓再套一次
export async function commit(
  io: Io,
  change: (data: TripData) => TripData,
  message: string,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<TripData> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(RETRY_STEP_MS * attempt)
    const snap = await io.read()
    const next = change(snap.data)
    // 沒有實際變化（例如刪掉已經不存在的行程）就不留空的修改紀錄
    if (JSON.stringify(next) === JSON.stringify(snap.data)) return snap.data
    try {
      await io.write(next, snap.sha, message)
      return next
    } catch (e) {
      if (e instanceof StoreError && e.code === 'conflict') continue
      throw e
    }
  }
  throw new StoreError('conflict')
}
