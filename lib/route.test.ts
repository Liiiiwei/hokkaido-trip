import { describe, expect, it, vi } from 'vitest'
import { fetchDrive, formatDrive } from './route'

const a = { lat: 43.1, lng: 141.34 }
const b = { lat: 43.0867, lng: 141.2042 }
const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))

describe('fetchDrive', () => {
  it('回傳開車的分鐘數與公里數，網址的座標是經度在前', async () => {
    const fetchFn = ok({ code: 'Ok', routes: [{ duration: 1790, distance: 12345 }] })
    expect(await fetchDrive(a, b, fetchFn as unknown as typeof fetch)).toEqual({ minutes: 30, km: 12.3 })
    const [url] = fetchFn.mock.calls[0] as unknown as [string]
    expect(url).toContain('/route/v1/driving/141.34,43.1;141.2042,43.0867')
  })
  it('不到一分鐘算一分鐘', async () => {
    const fetchFn = ok({ code: 'Ok', routes: [{ duration: 20, distance: 150 }] })
    expect(await fetchDrive(a, b, fetchFn as unknown as typeof fetch)).toEqual({ minutes: 1, km: 0.2 })
  })
  it('找不到路線、服務出錯或斷線時丟 network', async () => {
    const none = ok({ code: 'NoRoute', routes: [] }) as unknown as typeof fetch
    await expect(fetchDrive(a, b, none)).rejects.toMatchObject({ code: 'network' })
    const down = (async () => new Response('x', { status: 503 })) as unknown as typeof fetch
    await expect(fetchDrive(a, b, down)).rejects.toMatchObject({ code: 'network' })
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(fetchDrive(a, b, offline)).rejects.toMatchObject({ code: 'network' })
  })
})

describe('formatDrive', () => {
  it('一小時內寫分鐘，公里數十公里以上取整數', () => {
    expect(formatDrive({ minutes: 30, km: 12.3 })).toBe('開車約 30 分 · 12 公里')
    expect(formatDrive({ minutes: 8, km: 3.4 })).toBe('開車約 8 分 · 3.4 公里')
  })
  it('超過一小時寫成幾小時幾分', () => {
    expect(formatDrive({ minutes: 125, km: 140.2 })).toBe('開車約 2 小時 5 分 · 140 公里')
    expect(formatDrive({ minutes: 60, km: 55 })).toBe('開車約 1 小時 · 55 公里')
  })
})
