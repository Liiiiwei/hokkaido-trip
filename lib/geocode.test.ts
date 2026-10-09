import { describe, expect, it, vi } from 'vitest'
import { searchPlaces } from './geocode'

const ok = (rows: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 }))

describe('searchPlaces', () => {
  it('把搜尋結果整理成名稱、地址與座標', async () => {
    const fetchFn = ok([
      { name: '小樽運河', display_name: '小樽運河, 小樽市, 北海道, 日本', lat: '43.1990', lon: '141.0010' },
      { name: '', display_name: '運河公園, 小樽市', lat: '43.2', lon: '141.01' },
    ])
    const out = await searchPlaces(' Otaru Canal ', fetchFn as unknown as typeof fetch)
    expect(out).toEqual([
      { name: '小樽運河', address: '小樽運河, 小樽市, 北海道, 日本', lat: 43.199, lng: 141.001 },
      { name: '運河公園', address: '運河公園, 小樽市', lat: 43.2, lng: 141.01 },
    ])
    const [url] = fetchFn.mock.calls[0] as unknown as [string]
    expect(url.startsWith('https://nominatim.openstreetmap.org/search?')).toBe(true)
    expect(new URL(url).searchParams.get('q')).toBe('Otaru Canal')
  })
  it('空白的搜尋不發請求', async () => {
    const fetchFn = ok([])
    expect(await searchPlaces('   ', fetchFn as unknown as typeof fetch)).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })
  it('略過座標壞掉的結果；回應不是陣列時當成沒找到', async () => {
    const mixed = ok([{ name: 'A', display_name: 'A', lat: 'x', lon: '1' }, { name: 'B', display_name: 'B', lat: '1', lon: '2' }])
    expect((await searchPlaces('a', mixed as unknown as typeof fetch)).map((r) => r.name)).toEqual(['B'])
    expect(await searchPlaces('a', ok({ error: 'oops' }) as unknown as typeof fetch)).toEqual([])
  })
  it('斷線或服務出錯時丟 network', async () => {
    const down = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch
    await expect(searchPlaces('a', down)).rejects.toMatchObject({ code: 'network' })
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(searchPlaces('a', offline)).rejects.toMatchObject({ code: 'network' })
  })
})
