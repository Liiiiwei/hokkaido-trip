import { describe, expect, it } from 'vitest'
import { googlePlaceUrl, googleTransitUrl, pinsOf, previousStop } from './maps'
import type { Item } from './types'

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
