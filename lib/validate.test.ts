import { describe, expect, it } from 'vitest'
import { parseTripData } from './validate'

const trip = { title: '測試旅程', start_date: '2030-05-01', end_date: '2030-05-03' }
const fullItem = {
  id: 'i1',
  day: '2030-05-02',
  start_time: '10:00',
  end_time: null,
  title: '溫泉',
  place: '',
  note: '',
  kind: 'split',
  created_by: '小明',
  updated_at: '2030-01-01T00:00:00Z',
}

describe('parseTripData', () => {
  it('完整的資料原樣通過', () => {
    const data = {
      trip,
      days: [{ date: '2030-05-01', city: '札幌', note: '' }],
      items: [fullItem],
      itemMembers: [{ item_id: 'i1', member_name: '小明' }],
    }
    expect(parseTripData(data)).toEqual(data)
  })
  it('手動編輯時漏掉的選填欄位補上預設值', () => {
    const out = parseTripData({
      trip,
      items: [{ id: 'i1', day: '2030-05-02', title: '溫泉', kind: 'all' }],
    })
    expect(out.days).toEqual([])
    expect(out.itemMembers).toEqual([])
    expect(out.items[0]).toEqual({
      id: 'i1',
      day: '2030-05-02',
      start_time: null,
      end_time: null,
      title: '溫泉',
      place: '',
      note: '',
      kind: 'all',
      created_by: '',
      updated_at: '',
    })
  })
  it('缺旅程、行程不是陣列、行程缺必要欄位時丟 bad_data', () => {
    const bad = [
      null,
      'text',
      { items: [] },
      { trip: { title: '只有名稱' }, items: [] },
      { trip, items: 'oops' },
      { trip, items: [{ id: 'i1', day: '2030-05-02', kind: 'all' }] },
      { trip, items: [{ id: 'i1', day: '2030-05-02', title: 't', kind: '其他' }] },
      { trip, items: [], itemMembers: [{ item_id: 'i1' }] },
    ]
    for (const value of bad) expect(() => parseTripData(value)).toThrow('bad_data')
  })
})

describe('parseTripData 的座標', () => {
  const base = { id: 'i1', day: '2030-05-02', title: '溫泉', kind: 'all' }
  const parse = (extra: object) => parseTripData({ trip, items: [{ ...base, ...extra }] }).items[0]
  it('保留合理的座標', () => {
    expect(parse({ lat: 43.06, lng: 141.35 })).toMatchObject({ lat: 43.06, lng: 141.35 })
  })
  it('座標不完整、不是數字或超出範圍時當成沒定位', () => {
    for (const extra of [{ lat: 43.06 }, { lat: '43', lng: '141' }, { lat: 95, lng: 141 }, { lat: null, lng: null }]) {
      const out = parse(extra)
      expect(out.lat).toBeUndefined()
      expect(out.lng).toBeUndefined()
    }
  })
})
