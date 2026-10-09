import { describe, expect, it } from 'vitest'
import { setTrip } from './changes'
import type { Item, TripData } from './types'

const item = (id: string, day: string): Item => ({
  id,
  day,
  start_time: null,
  end_time: null,
  title: 't',
  place: '',
  note: '',
  kind: 'all',
  created_by: 'a',
  updated_at: '',
})

const data: TripData = {
  trip: { title: '測試旅程', start_date: '2030-05-01', end_date: '2030-05-05' },
  days: [],
  items: [item('i1', '2030-05-02'), item('i2', '2030-05-05')],
  itemMembers: [],
}

describe('setTrip', () => {
  it('新日期涵蓋所有行程時更新旅程', () => {
    const next = { title: '新名稱', start_date: '2030-05-02', end_date: '2030-05-05' }
    expect(setTrip(next)(data).trip).toEqual(next)
  })
  it('寫入當下才發現被排除的日子有行程時擋下來', () => {
    // 我的畫面上 5/5 還沒有行程，但別人剛新增了一個
    const next = { title: '測試旅程', start_date: '2030-05-01', end_date: '2030-05-04' }
    expect(() => setTrip(next)(data)).toThrow('dates_in_use')
  })
})
