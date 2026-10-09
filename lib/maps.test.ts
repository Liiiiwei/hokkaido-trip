import { describe, expect, it } from 'vitest'
import {
  googlePlaceUrl,
  googleTransitUrl,
  overviewOf,
  pinsOf,
  previousStop,
  stayPinsOf,
  staySpot,
} from './maps'
import type { Day, Item } from './types'

const item = (over: Partial<Item>): Item => ({
  id: 'x',
  day: '2030-05-02',
  start_time: null,
  end_time: null,
  title: 't',
  place: '',
  note: '',
  kind: 'all',
  created_by: 'a',
  updated_at: '',
  ...over,
})

const param = (url: string, name: string) => new URL(url).searchParams.get(name)

describe('googlePlaceUrl', () => {
  it('用地點文字搜尋，Google 才會顯示店家或景點的資訊', () => {
    const url = googlePlaceUrl(item({ place: '小樽運河', lat: 43.19, lng: 141.0 }))
    expect(url.startsWith('https://www.google.com/maps/search/?')).toBe(true)
    expect(param(url, 'api')).toBe('1')
    expect(param(url, 'query')).toBe('小樽運河')
  })
})

describe('googleTransitUrl', () => {
  it('有上一站時從上一站出發，走大眾運輸', () => {
    const url = googleTransitUrl(item({ place: '札幌站' }), item({ place: '小樽運河' }))
    expect(url.startsWith('https://www.google.com/maps/dir/?')).toBe(true)
    expect(param(url, 'origin')).toBe('札幌站')
    expect(param(url, 'destination')).toBe('小樽運河')
    expect(param(url, 'travelmode')).toBe('transit')
  })
  it('沒有上一站時不帶起點，讓 Google 用目前位置', () => {
    const url = googleTransitUrl(null, item({ place: '小樽運河' }))
    expect(param(url, 'origin')).toBeNull()
    expect(param(url, 'destination')).toBe('小樽運河')
  })
  it('定位過的地點用座標，路線才不會因為同名地點跑錯', () => {
    const url = googleTransitUrl(
      item({ place: '飯店', lat: 43.06, lng: 141.35 }),
      item({ place: '運河', lat: 43.19, lng: 141.0 }),
    )
    expect(param(url, 'origin')).toBe('43.06,141.35')
    expect(param(url, 'destination')).toBe('43.19,141')
  })
})

describe('pinsOf', () => {
  it('只留定位過的行程，依時間順序編號', () => {
    const pins = pinsOf([
      item({ id: 'c', start_time: '15:00', title: '晚', lat: 3, lng: 3 }),
      item({ id: 'a', start_time: '09:00', title: '早', lat: 1, lng: 1 }),
      item({ id: 'b', start_time: '12:00', title: '沒定位', place: '某處' }),
      item({ id: 'd', start_time: '13:00', title: '只有一半', lat: 2, lng: null }),
    ])
    expect(pins).toEqual([
      { id: 'a', n: 1, title: '早', lat: 1, lng: 1 },
      { id: 'c', n: 2, title: '晚', lat: 3, lng: 3 },
    ])
  })
})

describe('previousStop', () => {
  const hotel = item({ id: 'h', start_time: '08:00', place: '飯店' })
  const lunch = item({ id: 'l', start_time: '12:00', place: '' })
  const canal = item({ id: 'c', start_time: '14:00', place: '運河' })
  it('回傳我的行程裡、時間在它之前、而且有地點的最後一站', () => {
    expect(previousStop([hotel, lunch, canal], canal)?.id).toBe('h')
  })
  it('當天第一站沒有上一站', () => {
    expect(previousStop([hotel, lunch, canal], hotel)).toBeNull()
  })
  it('看別人那一團的行程時，起點是我自己的上一站', () => {
    const theirs = item({ id: 't', start_time: '15:00', place: '滑雪場', kind: 'split' })
    expect(previousStop([hotel, canal], theirs)?.id).toBe('c')
  })
})

describe('抵達地點', () => {
  const flight = item({ id: 'f', start_time: '10:00', place: '羽田機場', lat: 35.55, lng: 139.78, arrive_place: '新千歲機場' })
  it('上一站有抵達地點時，從抵達地點出發，不用出發地的座標', () => {
    const url = googleTransitUrl(flight, item({ place: '札幌站' }))
    expect(param(url, 'origin')).toBe('新千歲機場')
  })
  it('只填抵達地點、沒填出發地點的行程也算上一站', () => {
    const ride = item({ id: 'r', start_time: '09:00', place: '', arrive_place: '旭川站' })
    const next = item({ id: 'n', start_time: '12:00', place: '動物園' })
    expect(previousStop([ride, next], next)?.id).toBe('r')
  })
  it('去這一站的終點仍是它的地點，不是它的抵達地點', () => {
    const url = googleTransitUrl(null, flight)
    expect(param(url, 'destination')).toBe('35.55,139.78')
  })
})

const day = (date: string, over: Partial<Day> = {}): Day => ({ date, city: '', note: '', ...over })

describe('stayPinsOf', () => {
  it('當天地圖放前一晚與當晚的住宿', () => {
    const days = [
      day('2030-05-01', { stay: 'A 飯店', lat: 1, lng: 1 }),
      day('2030-05-02', { stay: 'B 民宿', lat: 2, lng: 2 }),
      day('2030-05-03', { stay: 'C', lat: 3, lng: 3 }),
    ]
    expect(stayPinsOf(days, '2030-05-02')).toEqual([
      { title: 'A 飯店', lat: 1, lng: 1 },
      { title: 'B 民宿', lat: 2, lng: 2 },
    ])
  })
  it('連住同一間只放一個', () => {
    const days = [
      day('2030-05-01', { stay: 'A', lat: 1, lng: 1 }),
      day('2030-05-02', { stay: 'A', lat: 1, lng: 1 }),
    ]
    expect(stayPinsOf(days, '2030-05-02')).toEqual([{ title: 'A', lat: 1, lng: 1 }])
  })
  it('沒定位的住宿不放；沒填名稱時用城市當名稱', () => {
    const days = [day('2030-05-01', { stay: '沒定位' }), day('2030-05-02', { city: '札幌', lat: 2, lng: 2 })]
    expect(stayPinsOf(days, '2030-05-02')).toEqual([{ title: '札幌', lat: 2, lng: 2 }])
  })
  it('跨月份也找得到前一晚', () => {
    const days = [day('2030-04-30', { stay: 'A', lat: 1, lng: 1 })]
    expect(stayPinsOf(days, '2030-05-01')).toEqual([{ title: 'A', lat: 1, lng: 1 }])
  })
})

describe('staySpot', () => {
  it('有住宿名稱或座標就能當路線起點', () => {
    expect(staySpot(day('2030-05-01', { stay: 'A 飯店' }))).toEqual({ title: 'A 飯店', place: 'A 飯店' })
    expect(staySpot(day('2030-05-01', { city: '札幌', lat: 1, lng: 2 }))).toEqual({
      title: '札幌',
      place: '',
      lat: 1,
      lng: 2,
    })
  })
  it('只填城市、或那天沒資料，不能當起點', () => {
    expect(staySpot(day('2030-05-01', { city: '札幌' }))).toBeNull()
    expect(staySpot(undefined)).toBeNull()
  })
})

describe('overviewOf', () => {
  const items = [
    item({ id: 'b', day: '2030-05-02', start_time: '10:00', title: '二日早', lat: 5, lng: 5 }),
    item({ id: 'a2', day: '2030-05-01', start_time: '15:00', title: '一日晚', lat: 2, lng: 2 }),
    item({ id: 'a1', day: '2030-05-01', start_time: '09:00', title: '一日早', lat: 1, lng: 1 }),
    item({ id: 'x', day: '2030-05-03', title: '沒定位' }),
  ]
  const days = [
    day('2030-05-02', { stay: 'A', lat: 9, lng: 9 }),
    day('2030-05-01', { stay: 'A', lat: 9, lng: 9 }),
    day('2030-05-03', { stay: 'B', lat: 8, lng: 8 }),
    day('2030-05-04', { stay: '沒定位' }),
  ]
  it('依日期分組，每天各自依時間編號，沒有定位地點的日子不列', () => {
    expect(overviewOf(items, days).groups).toEqual([
      {
        date: '2030-05-01',
        stops: [
          { id: 'a1', n: 1, title: '一日早', lat: 1, lng: 1 },
          { id: 'a2', n: 2, title: '一日晚', lat: 2, lng: 2 },
        ],
      },
      { date: '2030-05-02', stops: [{ id: 'b', n: 1, title: '二日早', lat: 5, lng: 5 }] },
    ])
  })
  it('連住同一間的住宿合成一個，記下住了哪幾晚', () => {
    expect(overviewOf(items, days).stays).toEqual([
      { title: 'A', lat: 9, lng: 9, dates: ['2030-05-01', '2030-05-02'] },
      { title: 'B', lat: 8, lng: 8, dates: ['2030-05-03'] },
    ])
  })
})
