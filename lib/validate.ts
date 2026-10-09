import { StoreError } from './errors'
import type { Day, Item, ItemMember, TripData } from './types'

type Rec = Record<string, unknown>

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

function required(v: unknown): string {
  if (typeof v !== 'string' || v === '') throw new StoreError('bad_data')
  return v
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const time = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

function records(v: unknown): Rec[] {
  if (v === undefined) return []
  if (!Array.isArray(v) || !v.every(isRecord)) throw new StoreError('bad_data')
  return v
}

// 檢查資料檔的結構。有人直接在 GitHub 上改檔案時可能漏欄位或打錯：
// 選填欄位補預設值，必要欄位缺了就丟 bad_data，讓畫面顯示說明而不是當掉
export function parseTripData(value: unknown): TripData {
  if (!isRecord(value) || !isRecord(value.trip) || !Array.isArray(value.items)) {
    throw new StoreError('bad_data')
  }
  const days: Day[] = records(value.days).map((d) => ({
    date: required(d.date),
    city: text(d.city),
    note: text(d.note),
  }))
  const items: Item[] = records(value.items).map((i) => {
    if (i.kind !== 'all' && i.kind !== 'split') throw new StoreError('bad_data')
    return {
      id: required(i.id),
      day: required(i.day),
      start_time: time(i.start_time),
      end_time: time(i.end_time),
      title: required(i.title),
      place: text(i.place),
      note: text(i.note),
      kind: i.kind,
      created_by: text(i.created_by),
      updated_at: text(i.updated_at),
    }
  })
  const itemMembers: ItemMember[] = records(value.itemMembers).map((m) => ({
    item_id: required(m.item_id),
    member_name: required(m.member_name),
  }))
  return {
    trip: {
      title: required(value.trip.title),
      start_date: required(value.trip.start_date),
      end_date: required(value.trip.end_date),
    },
    days,
    items,
    itemMembers,
  }
}
