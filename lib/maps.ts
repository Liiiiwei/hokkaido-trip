import { sortItems } from './schedule'
import type { Item } from './types'

type Spot = Pick<Item, 'place' | 'lat' | 'lng'>

export type Pin = { id: string; n: number; title: string; lat: number; lng: number }

const coordsOf = (spot: Spot): { lat: number; lng: number } | null =>
  typeof spot.lat === 'number' && typeof spot.lng === 'number'
    ? { lat: spot.lat, lng: spot.lng }
    : null

// 有地點文字或定位過，才有地方可以導航
export const hasSpot = (spot: Spot): boolean => spot.place !== '' || coordsOf(spot) !== null

// 路線的端點：定位過用座標，同名地點才不會跑錯；沒定位就用地點文字
function pointOf(spot: Spot): string {
  const c = coordsOf(spot)
  return c ? `${c.lat},${c.lng}` : spot.place
}

// 在 Google 地圖看這個地點。用文字搜尋才會出現店家或景點的資訊
export function googlePlaceUrl(spot: Spot): string {
  const query = spot.place || pointOf(spot)
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query })}`
}

// 在 Google 地圖查大眾運輸路線。沒有上一站就不帶起點，Google 會用目前位置
export function googleTransitUrl(from: Spot | null, to: Spot): string {
  const params = new URLSearchParams({ api: '1' })
  if (from) params.set('origin', pointOf(from))
  params.set('destination', pointOf(to))
  params.set('travelmode', 'transit')
  return `https://www.google.com/maps/dir/?${params}`
}

// 當天地圖上的圖釘：只留定位過的行程，依時間順序編號
export function pinsOf(items: Item[]): Pin[] {
  const pins: Pin[] = []
  for (const item of sortItems(items)) {
    const c = coordsOf(item)
    if (c) pins.push({ id: item.id, n: pins.length + 1, title: item.title, ...c })
  }
  return pins
}

// 「怎麼去」的起點：我自己的行程裡，排在這個行程之前、而且有地點的最後一站
export function previousStop(mine: Item[], item: Item): Item | null {
  const ordered = sortItems([...mine.filter((i) => i.id !== item.id), item])
  const at = ordered.findIndex((i) => i.id === item.id)
  for (let k = at - 1; k >= 0; k -= 1) {
    if (hasSpot(ordered[k])) return ordered[k]
  }
  return null
}
