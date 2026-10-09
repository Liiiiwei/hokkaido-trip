import { StoreError } from './errors'

export type PlaceResult = { name: string; address: string; lat: number; lng: number }

const ENDPOINT = 'https://nominatim.openstreetmap.org/search'

// 用 OpenStreetMap 的搜尋服務找地點，不需要金鑰。
// 服務規定一秒最多一次、不能邊打字邊查，所以只在按下按鈕時呼叫
export async function searchPlaces(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<PlaceResult[]> {
  const q = query.trim()
  if (!q) return []
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    limit: '5',
    'accept-language': 'zh-TW,ja,en',
  })
  let rows: unknown
  try {
    const res = await fetchFn(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(String(res.status))
    rows = await res.json()
  } catch {
    throw new StoreError('network')
  }
  if (!Array.isArray(rows)) return []
  const out: PlaceResult[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as Record<string, unknown>
    const lat = Number(r.lat)
    const lng = Number(r.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const address = typeof r.display_name === 'string' ? r.display_name : ''
    const name = typeof r.name === 'string' && r.name ? r.name : address.split(',')[0].trim()
    out.push({ name, address, lat, lng })
  }
  return out
}
