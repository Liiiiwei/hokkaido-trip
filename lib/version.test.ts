import { describe, expect, it, vi } from 'vitest'
import { decide, fetchLatest, reloadUrl } from './version'

describe('decide', () => {
  it('版本一樣就不用動', () => {
    expect(decide('a', 'a', null)).toBe('ok')
  })
  it('線上有新版就重新整理', () => {
    expect(decide('a', 'b', null)).toBe('reload')
  })
  it('已經為了這一版重新整理過卻還是舊的，不再重來，避免一直轉', () => {
    expect(decide('a', 'b', 'b')).toBe('gave_up')
  })
  it('之後又出了更新的一版，會再試一次', () => {
    expect(decide('a', 'c', 'b')).toBe('reload')
  })
  it('查不到線上版本、或本機開發，都當成沒事', () => {
    expect(decide('a', null, null)).toBe('ok')
    expect(decide('dev', 'b', null)).toBe('ok')
  })
})

describe('fetchLatest', () => {
  it('讀出線上的版本代號，而且不吃快取', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: 'abc' }), { status: 200 }))
    expect(await fetchLatest(fetchFn as unknown as typeof fetch, '/hokkaido-trip')).toBe('abc')
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url.startsWith('/hokkaido-trip/version.json?t=')).toBe(true)
    expect(init.cache).toBe('no-store')
  })
  it('斷線、找不到檔案或格式不對時回 null，不擋使用', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    expect(await fetchLatest(offline, '')).toBeNull()
    const missing = (async () => new Response('not found', { status: 404 })) as unknown as typeof fetch
    expect(await fetchLatest(missing, '')).toBeNull()
    const odd = (async () => new Response(JSON.stringify({ id: 5 }), { status: 200 })) as unknown as typeof fetch
    expect(await fetchLatest(odd, '')).toBeNull()
  })
})

describe('reloadUrl', () => {
  it('加上版本參數避開快取，並保留原本的參數與 # 後面的內容', () => {
    expect(reloadUrl('https://x.test/hokkaido-trip/', 'abc')).toBe('https://x.test/hokkaido-trip/?v=abc')
    expect(reloadUrl('https://x.test/hokkaido-trip/?v=old&a=1#k=tok', 'abc')).toBe(
      'https://x.test/hokkaido-trip/?v=abc&a=1#k=tok',
    )
  })
})
