import { DATA_REPO } from './config'
import type { TripData } from './types'

export type ErrorCode = 'bad_key' | 'conflict' | 'network' | 'gone' | 'name_taken'

export class StoreError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode) {
    super(code)
    this.name = 'StoreError'
    this.code = code
  }
}

export type Snapshot = { data: TripData; sha: string }

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
  return JSON.parse(new TextDecoder().decode(bytes)) as TripData
}

function codeOf(status: number): ErrorCode {
  if (status === 401 || status === 404) return 'bad_key'
  if (status === 409 || status === 422) return 'conflict'
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
  if (!res.ok) throw new StoreError(codeOf(res.status))
  return res
}

// GitHub API 的回應預設會被瀏覽器快取 60 秒，所以一律不走快取
export async function readFile(key: string, fetchFn: typeof fetch = fetch): Promise<Snapshot> {
  const res = await call(fetchFn, `${API}?ref=${DATA_REPO.branch}`, {
    headers: headers(key),
    cache: 'no-store',
  })
  const body = (await res.json()) as { content: string; sha: string }
  return { data: decodeContent(body.content), sha: body.sha }
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
