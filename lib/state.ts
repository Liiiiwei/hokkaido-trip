import type { Day, Item, ItemInput, ItemMember, TripData } from './types'

export type Row = Record<string, unknown>

export type Change = {
  table: 'trip' | 'days' | 'items' | 'item_members'
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Row | null
  old: Row | null
}

const sameMember = (a: ItemMember, b: ItemMember) =>
  a.item_id === b.item_id && a.member_name === b.member_name

const toMember = (row: Row): ItemMember => ({
  item_id: String(row.item_id),
  member_name: String(row.member_name),
})

// 把一筆變更套進目前資料。同一筆套兩次結果相同，
// 所以同一筆修改被套兩次（例如衝突後重試）也不會重複。
export function applyChange(data: TripData, change: Change): TripData {
  const { table, eventType } = change
  const next = change.new
  const prev = change.old

  if (table === 'trip') {
    if (eventType === 'DELETE' || !next) return data
    return {
      ...data,
      trip: {
        title: String(next.title),
        start_date: String(next.start_date),
        end_date: String(next.end_date),
      },
    }
  }

  if (table === 'days') {
    const key = String((eventType === 'DELETE' ? prev : next)?.date)
    const rest = data.days.filter((d) => d.date !== key)
    if (eventType === 'DELETE' || !next) return { ...data, days: rest }
    return { ...data, days: [...rest, next as Day] }
  }

  if (table === 'items') {
    const id = String((eventType === 'DELETE' ? prev : next)?.id)
    const rest = data.items.filter((i) => i.id !== id)
    if (eventType === 'DELETE' || !next) {
      return {
        ...data,
        items: rest,
        itemMembers: data.itemMembers.filter((m) => m.item_id !== id),
      }
    }
    return { ...data, items: [...rest, next as Item] }
  }

  // item_members：先移掉舊鍵與新鍵，再視情況加回新列
  let rest = data.itemMembers
  if (prev && prev.item_id !== undefined) {
    const gone = toMember(prev)
    rest = rest.filter((m) => !sameMember(m, gone))
  }
  if (eventType === 'DELETE' || !next) return { ...data, itemMembers: rest }
  const added = toMember(next)
  return { ...data, itemMembers: [...rest.filter((m) => !sameMember(m, added)), added] }
}

const INPUT_KEYS = ['day', 'start_time', 'end_time', 'title', 'place', 'note', 'kind'] as const

// 編輯表單送出時只留真的改過的欄位，才不會把別人同時改的其他欄位蓋回舊值
export function changedFields(original: Item, input: ItemInput): Partial<ItemInput> {
  const patch: Partial<ItemInput> = {}
  for (const key of INPUT_KEYS) {
    if (original[key] !== input[key]) Object.assign(patch, { [key]: input[key] })
  }
  return patch
}
