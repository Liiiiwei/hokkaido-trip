export type ItemKind = 'all' | 'split'

export type Trip = { title: string; start_date: string; end_date: string }

export type Day = {
  date: string
  city: string
  note: string
  // 當晚住宿的名稱；在地圖上定位過才有座標
  stay?: string
  lat?: number | null
  lng?: number | null
}

export type Item = {
  id: string
  day: string
  start_time: string | null
  end_time: string | null
  title: string
  place: string
  note: string
  kind: ItemKind
  // 搭飛機或長途車才填：下一站的「怎麼去」從這裡出發
  arrive_place?: string
  // 在地圖上定位過才有
  lat?: number | null
  lng?: number | null
  created_by: string
  updated_at: string
}

export type ItemMember = { item_id: string; member_name: string }

// 新增或編輯行程時送出的欄位
export type ItemInput = Pick<
  Item,
  'day' | 'start_time' | 'end_time' | 'title' | 'place' | 'note' | 'kind' | 'lat' | 'lng' | 'arrive_place'
>

export type TripData = {
  trip: Trip
  days: Day[]
  items: Item[]
  itemMembers: ItemMember[]
}
