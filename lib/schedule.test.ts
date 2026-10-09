import { describe, expect, it } from 'vitest'
import type { Item, ItemMember } from './types'
import {
  buildBlocks,
  datesLosingItems,
  dayLabel,
  defaultDate,
  filterMine,
  listDates,
  localToday,
  membersOf,
  sortItems,
} from './schedule'

const item = (over: Partial<Item>): Item => ({
  id: 'x',
  day: '2027-01-10',
  start_time: null,
  end_time: null,
  title: 't',
  place: '',
  note: '',
  kind: 'all',
  created_by: 'a',
  updated_at: '2027-01-01T00:00:00Z',
  ...over,
})

describe('listDates', () => {
  it('跨月也連續', () => {
    expect(listDates('2027-01-30', '2027-02-02')).toEqual([
      '2027-01-30',
      '2027-01-31',
      '2027-02-01',
      '2027-02-02',
    ])
  })
  it('同一天回傳一天', () => {
    expect(listDates('2027-01-09', '2027-01-09')).toEqual(['2027-01-09'])
  })
  it('回程早於出發回傳空陣列', () => {
    expect(listDates('2027-01-17', '2027-01-09')).toEqual([])
  })
  it('格式不對回傳空陣列', () => {
    expect(listDates('abc', '2027-01-09')).toEqual([])
    expect(listDates('20270-01-09', '20270-01-12')).toEqual([])
  })
  it('最多 366 天', () => {
    expect(listDates('2027-01-01', '2030-01-01')).toHaveLength(366)
  })
})

describe('sortItems', () => {
  it('依開始時間排，沒填時間的排最後', () => {
    const out = sortItems([
      item({ id: 'c', start_time: null }),
      item({ id: 'b', start_time: '14:00' }),
      item({ id: 'a', start_time: '09:30' }),
    ])
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
  it('同時間全員排在分開前面', () => {
    const out = sortItems([
      item({ id: 's', start_time: '10:00', kind: 'split' }),
      item({ id: 'a', start_time: '10:00', kind: 'all' }),
    ])
    expect(out.map((i) => i.id)).toEqual(['a', 's'])
  })
})

describe('buildBlocks', () => {
  it('同開始時間的分開行程併成一組', () => {
    const blocks = buildBlocks([
      item({ id: 's1', start_time: '10:00', kind: 'split', title: 'A 滑雪' }),
      item({ id: 'a1', start_time: '08:00', kind: 'all' }),
      item({ id: 's2', start_time: '10:00', kind: 'split', title: 'B 逛街' }),
      item({ id: 's3', start_time: '14:00', kind: 'split' }),
    ])
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ type: 'all' })
    expect(blocks[1]).toMatchObject({ type: 'split', startTime: '10:00' })
    expect(blocks[1].type === 'split' && blocks[1].items.map((i) => i.id)).toEqual(['s1', 's2'])
    expect(blocks[2]).toMatchObject({ type: 'split', startTime: '14:00' })
  })
  it('沒有行程回傳空陣列', () => {
    expect(buildBlocks([])).toEqual([])
  })
})

describe('filterMine 與 membersOf', () => {
  const members: ItemMember[] = [
    { item_id: 's1', member_name: '小明' },
    { item_id: 's1', member_name: '阿華' },
  ]
  const items = [
    item({ id: 'a1', kind: 'all' }),
    item({ id: 's1', kind: 'split' }),
    item({ id: 's2', kind: 'split' }),
  ]
  it('只留全員行程和我加入的分開行程', () => {
    expect(filterMine(items, members, '小明').map((i) => i.id)).toEqual(['a1', 's1'])
    expect(filterMine(items, members, '路人').map((i) => i.id)).toEqual(['a1'])
  })
  it('列出某個行程的成員', () => {
    expect(membersOf('s1', members)).toEqual(['小明', '阿華'])
    expect(membersOf('s2', members)).toEqual([])
  })
})

describe('datesLosingItems', () => {
  it('列出縮短後被排除、而且還有行程的日子', () => {
    const items = [
      item({ id: '1', day: '2027-01-09' }),
      item({ id: '2', day: '2027-01-17' }),
      item({ id: '3', day: '2027-01-17' }),
      item({ id: '4', day: '2027-01-12' }),
    ]
    expect(datesLosingItems(items, '2027-01-10', '2027-01-16')).toEqual([
      '2027-01-09',
      '2027-01-17',
    ])
    expect(datesLosingItems(items, '2027-01-09', '2027-01-17')).toEqual([])
  })
})

describe('日期顯示與預設日', () => {
  it('旅程期間內停在今天，其他時候停在第一天', () => {
    const dates = ['2027-01-09', '2027-01-10']
    expect(defaultDate(dates, '2027-01-10')).toBe('2027-01-10')
    expect(defaultDate(dates, '2026-10-09')).toBe('2027-01-09')
    expect(defaultDate([], '2026-10-09')).toBe('')
  })
  it('用裝置當地日期', () => {
    expect(localToday(new Date(2027, 0, 9, 23, 30))).toBe('2027-01-09')
  })
  it('顯示成 月/日（星期）', () => {
    expect(dayLabel('2027-01-09')).toBe('1/9（六）')
    expect(dayLabel('2027-01-17')).toBe('1/17（日）')
  })
})
