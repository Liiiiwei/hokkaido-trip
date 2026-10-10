import { sortItems } from './schedule'
import type { Day, Item } from './types'

type Spot = Pick<Item, 'place' | 'lat' | 'lng' | 'arrive_place'>

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
  // 上一站是航班或長途車時，人是在抵達地點，不是出發地點
  if (from) params.set('origin', from.arrive_place || pointOf(from))
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
    if (hasSpot(ordered[k]) || ordered[k].arrive_place) return ordered[k]
  }
  return null
}

export type StayPin = { title: string; lat: number; lng: number }

// 路線起點用的住宿：要有名稱或座標才找得到路，只填城市不夠
export type StaySpot = { title: string; place: string; lat?: number; lng?: number }

const stayTitle = (day: Day): string => day.stay || day.city || '住宿'

export function staySpot(day: Day | undefined): StaySpot | null {
  if (!day) return null
  const c = coordsOf({ place: '', lat: day.lat, lng: day.lng })
  if (!day.stay && !c) return null
  return { title: stayTitle(day), place: day.stay ?? '', ...c }
}

function stayPin(day: Day | undefined): StayPin | null {
  if (!day) return null
  const c = coordsOf({ place: '', lat: day.lat, lng: day.lng })
  return c ? { title: stayTitle(day), ...c } : null
}

// 前一天的日期；用 UTC 算才不會被時區或日光節約時間影響
export function prevDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

const samePlace = (a: StayPin, b: StayPin) => a.lat === b.lat && a.lng === b.lng

// 當天地圖上的住宿：早上出發的那間（前一晚）和當晚住的那間，同一間只放一個
export function stayPinsOf(days: Day[], date: string): StayPin[] {
  const find = (d: string) => stayPin(days.find((x) => x.date === d))
  const out: StayPin[] = []
  for (const pin of [find(prevDate(date)), find(date)]) {
    if (pin && !out.some((p) => samePlace(p, pin))) out.push(pin)
  }
  return out
}

export type Overview = {
  groups: { date: string; stops: Pin[] }[]
  stays: (StayPin & { dates: string[] })[]
}

// 全程地圖：行程依日期分組、每天各自編號；連住同一間的住宿合成一個
export function overviewOf(items: Item[], days: Day[]): Overview {
  const dates = [...new Set(items.map((i) => i.day))].sort()
  const groups = dates
    .map((date) => ({ date, stops: pinsOf(items.filter((i) => i.day === date)) }))
    .filter((g) => g.stops.length > 0)
  const stays: Overview['stays'] = []
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const pin = stayPin(day)
    if (!pin) continue
    const same = stays.find((s) => samePlace(s, pin))
    if (same) same.dates.push(day.date)
    else stays.push({ ...pin, dates: [day.date] })
  }
  return { groups, stays }
}

// 估車程用的起點座標。上一站是航班或長途車時，人在抵達地點，它的座標是出發地，不能用
export function originCoords(from: (Spot & { title?: string }) | null): { lat: number; lng: number } | null {
  if (!from || from.arrive_place) return null
  return coordsOf(from)
}

export const coordsOfSpot = (spot: Spot): { lat: number; lng: number } | null => coordsOf(spot)

// 我當天有地點的最後一站，回住宿的路從這裡算
export function lastStop(mine: Item[]): Item | null {
  const ordered = sortItems(mine)
  for (let k = ordered.length - 1; k >= 0; k -= 1) {
    if (hasSpot(ordered[k])) return ordered[k]
  }
  return null
}
