import { describe, expect, it } from 'vitest'
import { clearSnapshot, loadSnapshot, saveSnapshot } from './offline'
import type { TripData } from './types'

function memory() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

const data: TripData = {
  trip: { title: '北海道', start_date: '2027-01-09', end_date: '2027-01-17' },
  days: [{ date: '2027-01-09', city: '札幌', note: '' }],
  items: [
    {
      id: 'a',
      day: '2027-01-09',
      start_time: '10:00',
      end_time: null,
      title: '機場',
      place: '',
      note: '',
      kind: 'all',
      created_by: '甲',
      updated_at: '2027-01-01T00:00:00Z',
    },
  ],
  itemMembers: [],
}

describe('離線備份', () => {
  it('存進去再讀出來是同一份行程', () => {
    const box = memory()
    saveSnapshot(data, box)
    expect(loadSnapshot(box)).toEqual(data)
  })

  it('沒存過、或存的內容壞了，都當作沒有', () => {
    const box = memory()
    expect(loadSnapshot(box)).toBeNull()
    saveSnapshot(data, box)
    for (const key of box.map.keys()) box.map.set(key, '{"trip":')
    expect(loadSnapshot(box)).toBeNull()
    for (const key of box.map.keys()) box.map.set(key, '{"trip":{},"items":[]}')
    expect(loadSnapshot(box)).toBeNull()
  })

  it('清掉之後就讀不到', () => {
    const box = memory()
    saveSnapshot(data, box)
    clearSnapshot(box)
    expect(loadSnapshot(box)).toBeNull()
  })

  it('存不進去（空間滿了）不會讓程式壞掉', () => {
    const box = {
      ...memory(),
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(() => saveSnapshot(data, box)).not.toThrow()
  })

  it('沒有可用的儲存空間時安靜略過', () => {
    expect(() => saveSnapshot(data, null)).not.toThrow()
    expect(loadSnapshot(null)).toBeNull()
  })
})
