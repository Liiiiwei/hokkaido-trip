import { describe, expect, it } from 'vitest'
import { fetchDoor, normalizePass, parseDoor, seal, unseal } from './door'

// 測試用少一點的運算次數，跑得快
const FAST = 1000

describe('normalizePass', () => {
  it('全形數字算成半形、去掉頭尾空白', () => {
    expect(normalizePass(' １２３４　')).toBe('1234')
  })
})

describe('seal / unseal', () => {
  it('對的密語解得開', async () => {
    const door = await seal('token_abc', '雪祭見', FAST)
    expect(await unseal(door, '雪祭見')).toBe('token_abc')
  })

  it('全形輸入也解得開', async () => {
    const door = await seal('token_abc', 'snow2027', FAST)
    expect(await unseal(door, ' ｓｎｏｗ２０２７ ')).toBe('token_abc')
  })

  it('密語不對回 null', async () => {
    const door = await seal('token_abc', '雪祭見', FAST)
    expect(await unseal(door, '雪祭')).toBeNull()
  })

  it('加密檔裡看不到權杖，每次加密結果都不同', async () => {
    const a = await seal('token_abc', 'pass', FAST)
    const b = await seal('token_abc', 'pass', FAST)
    expect(JSON.stringify(a)).not.toContain('token_abc')
    expect(a.data).not.toBe(b.data)
  })

  it('檔案內容被改壞時回 null，不會丟錯', async () => {
    const door = await seal('token_abc', 'pass', FAST)
    expect(await unseal({ ...door, data: '不是 base64' }, 'pass')).toBeNull()
  })
})

describe('parseDoor', () => {
  it('欄位齊全才收', async () => {
    const door = await seal('t', 'p', FAST)
    expect(parseDoor(JSON.parse(JSON.stringify(door)))).toEqual(door)
    expect(parseDoor({ ...door, v: 2 })).toBeNull()
    expect(parseDoor({ ...door, iterations: 0 })).toBeNull()
    expect(parseDoor({ ...door, salt: 1 })).toBeNull()
    expect(parseDoor(null)).toBeNull()
  })
})

describe('fetchDoor', () => {
  const reply = (status: number, body: unknown) =>
    (async () =>
      new Response(JSON.stringify(body), {
        status,
      })) as unknown as typeof fetch

  it('讀到就回內容', async () => {
    const door = await seal('t', 'p', FAST)
    expect(await fetchDoor(reply(200, door), '/base')).toEqual(door)
  })

  it('沒有這個檔案、或內容不對，都當成沒設密語', async () => {
    expect(await fetchDoor(reply(404, {}), '')).toBe('none')
    expect(await fetchDoor(reply(200, { hello: 1 }), '')).toBe('none')
  })

  it('連不上或伺服器出錯回 offline', async () => {
    expect(await fetchDoor(reply(503, {}), '')).toBe('offline')
    const broken = (async () => {
      throw new TypeError('failed')
    }) as unknown as typeof fetch
    expect(await fetchDoor(broken, '')).toBe('offline')
  })
})
