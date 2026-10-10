import { describe, expect, it, vi } from 'vitest'
import { fetchDrive, formatDrive, makeDriveQueue } from './route'

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

describe('makeDriveQueue', () => {
  const body = JSON.stringify({ code: 'Ok', routes: [{ duration: 600, distance: 5000 }] })
  it('一次只問一段，免費服務才不會因為同時太多請求而拒絕', async () => {
    let running = 0
    let peak = 0
    const fetchFn = (async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running -= 1
      return new Response(body, { status: 200 })
    }) as unknown as typeof fetch
    const ask = makeDriveQueue(fetchFn, async () => {})
    const out = await Promise.all([ask(a, b), ask(b, a), ask(a, { lat: 1, lng: 1 })])
    expect(peak).toBe(1)
    expect(out).toHaveLength(3)
  })
  it('被拒絕時等一下再試一次', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(new Response(body, { status: 200 }))
    const wait = vi.fn(async () => {})
    const ask = makeDriveQueue(fetchFn as unknown as typeof fetch, wait)
    expect(await ask(a, b)).toEqual({ minutes: 10, km: 5 })
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalled()
  })
  it('試第二次還是失敗就放棄，而且不卡住後面排隊的', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(new Response(body, { status: 200 }))
    const ask = makeDriveQueue(fetchFn as unknown as typeof fetch, async () => {})
    const first = ask(a, b)
    const second = ask(b, a)
    await expect(first).rejects.toMatchObject({ code: 'network' })
    expect(await second).toEqual({ minutes: 10, km: 5 })
  })
})
