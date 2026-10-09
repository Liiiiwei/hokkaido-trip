import { describe, expect, it } from 'vitest'
import { applyChange, changedFields } from './state'
import type { Item, TripData } from './types'

const item = (id: string, title = 't'): Item => ({
  id,
  day: '2027-01-10',
  start_time: null,
  end_time: null,
  title,
  place: '',
  note: '',
  kind: 'split',
  created_by: 'a',
  updated_at: '2027-01-01T00:00:00Z',
})

const base: TripData = {
  trip: { title: '北海道行程', start_date: '2027-01-09', end_date: '2027-01-17' },
  days: [{ date: '2027-01-09', city: '東京', note: '' }],
  items: [item('i1')],
  itemMembers: [{ item_id: 'i1', member_name: '小明' }],
}

describe('applyChange', () => {
  it('更新旅程，只留三個欄位', () => {
    const out = applyChange(base, {
      table: 'trip',
      eventType: 'UPDATE',
      new: { id: 1, title: '雪國', start_date: '2027-01-09', end_date: '2027-01-18' },
      old: { id: 1 },
    })
    expect(out.trip).toEqual({ title: '雪國', start_date: '2027-01-09', end_date: '2027-01-18' })
  })

  it('新增與更新某一天', () => {
    const added = applyChange(base, {
      table: 'days',
      eventType: 'INSERT',
      new: { date: '2027-01-10', city: '札幌', note: '' },
      old: null,
    })
    expect(added.days).toHaveLength(2)
    const updated = applyChange(added, {
      table: 'days',
      eventType: 'UPDATE',
      new: { date: '2027-01-10', city: '小樽', note: '' },
      old: { date: '2027-01-10' },
    })
    expect(updated.days.find((d) => d.date === '2027-01-10')?.city).toBe('小樽')
    expect(updated.days).toHaveLength(2)
  })

  it('同一筆新增行程套兩次只有一筆', () => {
    const change = { table: 'items', eventType: 'INSERT', new: item('i2'), old: null } as const
    const out = applyChange(applyChange(base, change), change)
    expect(out.items.filter((i) => i.id === 'i2')).toHaveLength(1)
  })

  it('更新行程會取代舊內容', () => {
    const out = applyChange(base, {
      table: 'items',
      eventType: 'UPDATE',
      new: item('i1', '新標題'),
      old: { id: 'i1' },
    })
    expect(out.items).toHaveLength(1)
    expect(out.items[0].title).toBe('新標題')
  })

  it('刪除行程會連同成員一起移除', () => {
    const out = applyChange(base, {
      table: 'items',
      eventType: 'DELETE',
      new: null,
      old: { id: 'i1' },
    })
    expect(out.items).toEqual([])
    expect(out.itemMembers).toEqual([])
  })

  it('刪除不存在的行程不出錯、資料不變', () => {
    const out = applyChange(base, {
      table: 'items',
      eventType: 'DELETE',
      new: null,
      old: { id: '不存在' },
    })
    expect(out.items).toEqual(base.items)
    expect(out.itemMembers).toEqual(base.itemMembers)
  })

  it('同一筆加入套兩次，名字只出現一次', () => {
    const change = {
      table: 'item_members',
      eventType: 'INSERT',
      new: { item_id: 'i1', member_name: '阿華' },
      old: null,
    } as const
    const out = applyChange(applyChange(base, change), change)
    expect(out.itemMembers.filter((m) => m.member_name === '阿華')).toHaveLength(1)
    expect(out.itemMembers).toHaveLength(2)
  })

  it('退出會移除那一列', () => {
    const out = applyChange(base, {
      table: 'item_members',
      eventType: 'DELETE',
      new: null,
      old: { item_id: 'i1', member_name: '小明' },
    })
    expect(out.itemMembers).toEqual([])
  })

  it('改名（更新成員列）會換掉舊名字', () => {
    const out = applyChange(base, {
      table: 'item_members',
      eventType: 'UPDATE',
      new: { item_id: 'i1', member_name: '大明' },
      old: { item_id: 'i1', member_name: '小明' },
    })
    expect(out.itemMembers).toEqual([{ item_id: 'i1', member_name: '大明' }])
  })

  it('不會改到傳進來的資料', () => {
    const snapshot = JSON.stringify(base)
    applyChange(base, { table: 'items', eventType: 'DELETE', new: null, old: { id: 'i1' } })
    expect(JSON.stringify(base)).toBe(snapshot)
  })
})

describe('changedFields', () => {
  const original = item('i1', '原標題')
  const same = {
    day: original.day,
    start_time: original.start_time,
    end_time: original.end_time,
    title: original.title,
    place: original.place,
    note: original.note,
    kind: original.kind,
  }
  it('沒改任何欄位時是空的', () => {
    expect(changedFields(original, same)).toEqual({})
  })
  it('只回傳和原本不同的欄位', () => {
    expect(changedFields(original, { ...same, title: '新標題', start_time: '09:00' })).toEqual({
      title: '新標題',
      start_time: '09:00',
    })
  })
})

describe('changedFields 的座標', () => {
  const original = item('i1', '原標題')
  const same = {
    day: original.day,
    start_time: original.start_time,
    end_time: original.end_time,
    title: original.title,
    place: original.place,
    note: original.note,
    kind: original.kind,
  }
  it('定位或取消定位算是有改', () => {
    expect(changedFields(original, { ...same, lat: 43.06, lng: 141.35 })).toEqual({
      lat: 43.06,
      lng: 141.35,
    })
    expect(changedFields({ ...original, lat: 1, lng: 2 }, { ...same, lat: null, lng: null })).toEqual({
      lat: null,
      lng: null,
    })
  })
  it('本來就沒定位、表單送出 null，不算有改', () => {
    expect(changedFields(original, { ...same, lat: null, lng: null })).toEqual({})
  })
})

describe('changedFields 的抵達地點', () => {
  const original = item('i1', '航班')
  const same = {
    day: original.day,
    start_time: original.start_time,
    end_time: original.end_time,
    title: original.title,
    place: original.place,
    note: original.note,
    kind: original.kind,
  }
  it('填上抵達地點算是有改', () => {
    expect(changedFields(original, { ...same, arrive_place: '新千歲機場' })).toEqual({
      arrive_place: '新千歲機場',
    })
  })
  it('清掉抵達地點算是有改', () => {
    expect(changedFields({ ...original, arrive_place: '新千歲機場' }, { ...same, arrive_place: '' })).toEqual({
      arrive_place: '',
    })
  })
  it('本來就沒有、表單送出空字串，不算有改', () => {
    expect(changedFields(original, { ...same, arrive_place: '' })).toEqual({})
  })
})
