// 偵測網站有沒有出新版。舊版分頁存檔會把新版才有的欄位洗掉，所以要先換成新版

// 這份程式是哪一版；建置時帶入，本機開發是 dev
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const TRIED_KEY = 'trip:reloadedFor'

export type VersionAction = 'ok' | 'reload' | 'gave_up'

// mine：這個分頁的版本；latest：線上的版本；tried：已經為了哪一版重新整理過
export function decide(mine: string, latest: string | null, tried: string | null): VersionAction {
  if (mine === 'dev' || latest === null || latest === mine) return 'ok'
  // 重新整理過還是舊的（網站的快取還沒換），再來一次也一樣，先讓人照常使用
  return tried === latest ? 'gave_up' : 'reload'
}

// 讀線上的版本代號。讀不到就回 null：不能因為查版本失敗就擋住使用
export async function fetchLatest(
  fetchFn: typeof fetch = fetch,
  base: string = BASE,
): Promise<string | null> {
  try {
    const res = await fetchFn(`${base}/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const body: unknown = await res.json()
    const id = typeof body === 'object' && body !== null ? (body as { id?: unknown }).id : null
    return typeof id === 'string' && id !== '' ? id : null
  } catch {
    return null
  }
}

// 重新整理用的網址：加上版本參數，才不會又拿到快取裡的舊頁面
export function reloadUrl(href: string, id: string): string {
  const url = new URL(href)
  url.searchParams.set('v', id)
  return url.toString()
}

function tried(): string | null {
  try {
    return sessionStorage.getItem(TRIED_KEY)
  } catch {
    return null
  }
}

export async function versionStatus(): Promise<{ action: VersionAction; latest: string | null }> {
  if (BUILD_ID === 'dev' || typeof window === 'undefined') return { action: 'ok', latest: null }
  const latest = await fetchLatest()
  return { action: decide(BUILD_ID, latest, tried()), latest }
}

export function reloadToLatest(latest: string): void {
  try {
    sessionStorage.setItem(TRIED_KEY, latest)
  } catch {
    // 記不住就算了：最壞是多重新整理幾次
  }
  window.location.replace(reloadUrl(window.location.href, latest))
}

// 存檔時發現是舊版，通知畫面去換版
export const STALE_EVENT = 'trip:stale'
