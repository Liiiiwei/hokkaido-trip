export type ItemKind = 'all' | 'split'

export type Trip = { title: string; start_date: string; end_date: string }

export type Day = { date: string; city: string; note: string }

export type Item = {
  id: string
  day: string
  start_time: string | null
  end_time: string | null
  title: string
  place: string
  note: string
  kind: ItemKind
  created_by: string
  updated_at: string
}

export type ItemMember = { item_id: string; member_name: string }

// 新增或編輯行程時送出的欄位
export type ItemInput = Pick<
  Item,
  'day' | 'start_time' | 'end_time' | 'title' | 'place' | 'note' | 'kind'
>

export type TripData = {
  trip: Trip
  days: Day[]
  items: Item[]
  itemMembers: ItemMember[]
}
