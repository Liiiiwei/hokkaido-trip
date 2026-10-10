import { StoreError } from './errors'

export type LatLng = { lat: number; lng: number }
export type Drive = { minutes: number; km: number }

// OpenStreetMap 的公開路線服務，不需要金鑰。只算得出開車時間，沒有電車巴士的時刻表
const ENDPOINT = 'https://router.project-osrm.org/route/v1/driving'

export async function fetchDrive(
  from: LatLng,
  to: LatLng,
  fetchFn: typeof fetch = fetch,
): Promise<Drive> {
  try {
    // 這個服務的座標是經度在前
    const url = `${ENDPOINT}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
    const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(String(res.status))
    const body = (await res.json()) as { routes?: { duration?: unknown; distance?: unknown }[] }
    const route = body.routes?.[0]
    if (!route || typeof route.duration !== 'number' || typeof route.distance !== 'number') {
      throw new Error('no route')
    }
    return {
      minutes: Math.max(1, Math.round(route.duration / 60)),
      km: Math.round(route.distance / 100) / 10,
    }
  } catch {
    throw new StoreError('network')
  }
}

export function formatDrive({ minutes, km }: Drive): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const time = h === 0 ? `${m} 分` : m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`
  return `開車約 ${time} · ${km >= 10 ? Math.round(km) : km} 公里`
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// 排隊一段一段問：免費服務同時收到太多請求會拒絕。被拒絕時等一下再試一次
export function makeDriveQueue(
  fetchFn: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = sleep,
): (from: LatLng, to: LatLng) => Promise<Drive> {
  let tail: Promise<unknown> = Promise.resolve()
  return (from, to) => {
    const run = tail.then(async () => {
      try {
        return await fetchDrive(from, to, fetchFn)
      } catch {
        await wait(1500)
        return fetchDrive(from, to, fetchFn)
      }
    })
    // 這一段失敗不影響後面排隊的
    tail = run.then(
      () => wait(250),
      () => wait(250),
    )
    return run
  }
}

const queued = makeDriveQueue()

// 同一段路只問一次：輪詢重畫、切換日期都不會重複發請求
const cache = new Map<string, Promise<Drive>>()

export function driveKey(from: LatLng, to: LatLng): string {
  return `${from.lat},${from.lng}>${to.lat},${to.lng}`
}

export function cachedDrive(from: LatLng, to: LatLng): Promise<Drive> {
  const key = driveKey(from, to)
  let hit = cache.get(key)
  if (!hit) {
    hit = queued(from, to)
    cache.set(key, hit)
    // 失敗的不留著，下次再試
    hit.catch(() => cache.delete(key))
  }
  return hit
}
