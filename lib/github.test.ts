import { describe, expect, it, vi } from 'vitest'
import { applyChange } from './state'
import {
  StoreError,
  commit,
  decodeContent,
  encodeContent,
  readFile,
  writeFile,
  type Io,
} from './github'
import type { Item, TripData } from './types'

const item = (id: string): Item => ({
  id,
  day: '2030-05-02',
  start_time: '10:00',
  end_time: null,
  title: '溫泉♨️與拉麵🍜',
  place: '',
  note: '',
  kind: 'split',
  created_by: '小明',
  updated_at: '2030-01-01T00:00:00Z',
})

const base: TripData = {
  trip: { title: '測試旅程', start_date: '2030-05-01', end_date: '2030-05-03' },
  days: [],
  items: [item('i1')],
  itemMembers: [],
}

const join = (name: string) => (data: TripData) =>
  applyChange(data, {
    table: 'item_members',
    eventType: 'INSERT',
    new: { item_id: 'i1', member_name: name },
    old: null,
  })

const response = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status })

describe('編碼與解碼', () => {
  it('中文與表情符號來回一字不差', () => {
    expect(decodeContent(encodeContent(base))).toEqual(base)
  })
  it('讀得懂中間有換行的 base64', () => {
    const wrapped = encodeContent(base).replace(/(.{60})/g, '$1\n')
    expect(decodeContent(wrapped)).toEqual(base)
  })
})

describe('readFile', () => {
  it('帶著權杖、不走快取，回傳資料與版本代號', async () => {
    const fetchFn = vi.fn(async () => response(200, { content: encodeContent(base), sha: 'abc' }))
    const snap = await readFile('KEY', fetchFn as unknown as typeof fetch)
    expect(snap).toEqual({ data: base, sha: 'abc', etag: null })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/contents/trip.json')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer KEY')
    expect(init.cache).toBe('no-store')
    // 訊號差時不能無限期等下去
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('401 與 404 是權杖失效', async () => {
    for (const status of [401, 404]) {
      const fetchFn = (async () => response(status)) as unknown as typeof fetch
      await expect(readFile('KEY', fetchFn)).rejects.toMatchObject({ code: 'bad_key' })
    }
  })
  it('伺服器錯誤與斷線是網路問題', async () => {
    const down = (async () => response(500)) as unknown as typeof fetch
    await expect(readFile('KEY', down)).rejects.toMatchObject({ code: 'network' })
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(readFile('KEY', offline)).rejects.toMatchObject({ code: 'network' })
  })
})

describe('writeFile', () => {
  it('送出內容、版本代號與說明', async () => {
    const fetchFn = vi.fn(async () => response(200))
    await writeFile('KEY', base, 'abc', '新增行程', fetchFn as unknown as typeof fetch)
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('PUT')
    const body = JSON.parse(String(init.body))
    expect(body.sha).toBe('abc')
    expect(body.message).toBe('新增行程')
    expect(decodeContent(body.content)).toEqual(base)
  })
  it('409 與 422 是版本衝突', async () => {
    for (const status of [409, 422]) {
      const fetchFn = (async () => response(status)) as unknown as typeof fetch
      await expect(writeFile('KEY', base, 'abc', 'm', fetchFn)).rejects.toMatchObject({
        code: 'conflict',
      })
    }
  })
})

// 假的遠端檔案：寫入時版本代號不符就拒絕
function fakeRemote(initial: TripData) {
  let data = initial
  let version = 1
  const io: Io = {
    read: vi.fn(async () => ({ data, sha: String(version) })),
    write: vi.fn(async (next: TripData, sha: string) => {
      if (sha !== String(version)) throw new StoreError('conflict')
      data = next
      version += 1
    }),
  }
  return {
    io,
    current: () => data,
    // 模擬別人搶先存了一版
    someoneElse: (change: (d: TripData) => TripData) => {
      data = change(data)
      version += 1
    },
  }
}

const noWait = async () => {}

describe('commit', () => {
  it('沒有衝突時一次寫入', async () => {
    const remote = fakeRemote(base)
    const out = await commit(remote.io, join('小明'), '加入')
    expect(out.itemMembers).toEqual([{ item_id: 'i1', member_name: '小明' }])
    expect(remote.io.write).toHaveBeenCalledTimes(1)
  })

  it('被別人搶先存時重抓重試，兩邊的修改都留下', async () => {
    const remote = fakeRemote(base)
    let first = true
    const change = (data: TripData) => {
      // 第一次套用完、還沒寫入前，別人先存了
      if (first) {
        first = false
        remote.someoneElse(join('阿華'))
      }
      return join('小明')(data)
    }
    await commit(remote.io, change, '加入', noWait)
    const names = remote.current().itemMembers.map((m) => m.member_name).sort()
    expect(names).toEqual(['小明', '阿華'])
    expect(remote.io.read).toHaveBeenCalledTimes(2)
  })

  it('一直衝突時試五次後放棄', async () => {
    const remote = fakeRemote(base)
    // 每次要存之前都被別人搶先一步
    const change = (data: TripData) => {
      remote.someoneElse((d) => d)
      return join('小明')(data)
    }
    const waits: number[] = []
    const wait = async (ms: number) => {
      waits.push(ms)
    }
    await expect(commit(remote.io, change, 'm', wait)).rejects.toMatchObject({ code: 'conflict' })
    expect(remote.io.read).toHaveBeenCalledTimes(5)
    // 每次重試前等久一點，給 GitHub 時間更新版本
    expect(waits).toEqual([300, 600, 900, 1200])
  })

  it('修改途中丟錯就不寫入', async () => {
    const remote = fakeRemote(base)
    const change = () => {
      throw new StoreError('gone')
    }
    await expect(commit(remote.io, change, 'm')).rejects.toMatchObject({ code: 'gone' })
    expect(remote.io.write).not.toHaveBeenCalled()
  })
})

describe('錯誤分類', () => {
  const failing = (status: number, headers: Record<string, string> = {}) =>
    (async () => new Response('{}', { status, headers })) as unknown as typeof fetch

  it('429 與額度用完的 403 是忙線，不是斷線', async () => {
    await expect(readFile('KEY', failing(429))).rejects.toMatchObject({ code: 'busy' })
    await expect(
      readFile('KEY', failing(403, { 'x-ratelimit-remaining': '0' })),
    ).rejects.toMatchObject({ code: 'busy' })
    await expect(readFile('KEY', failing(403, { 'retry-after': '60' }))).rejects.toMatchObject({
      code: 'busy',
    })
  })
  it('其他 403 是權杖只能看不能改', async () => {
    await expect(writeFile('KEY', base, 'abc', 'm', failing(403))).rejects.toMatchObject({
      code: 'read_only',
    })
  })
})

describe('用 ETag 省額度', () => {
  it('回傳這次的 ETag', async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ content: encodeContent(base), sha: 'abc' }), {
        status: 200,
        headers: { etag: '"e1"' },
      })) as unknown as typeof fetch
    expect((await readFile('KEY', fetchFn)).etag).toBe('"e1"')
  })
  it('帶著上次的 ETag 詢問，304 時沿用上次的資料', async () => {
    const cached = { data: base, sha: 'abc', etag: '"e1"' }
    const fetchFn = vi.fn(async () => new Response(null, { status: 304 }))
    const snap = await readFile('KEY', fetchFn as unknown as typeof fetch, cached)
    expect(snap).toBe(cached)
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>)['If-None-Match']).toBe('"e1"')
  })
})

describe('資料檔壞掉', () => {
  const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
  it('不是 JSON 或結構不對時丟 bad_data，不是讓畫面當掉', () => {
    expect(() => decodeContent(b64('這不是 JSON'))).toThrow('bad_data')
    expect(() => decodeContent(b64('{"foo":1}'))).toThrow('bad_data')
  })
})

describe('沒有變化就不寫入', () => {
  it('修改後資料和原本一樣時不留空的修改紀錄', async () => {
    const remote = fakeRemote(base)
    const out = await commit(remote.io, (d) => ({ ...d, items: [...d.items] }), '刪除行程')
    expect(out).toEqual(base)
    expect(remote.io.write).not.toHaveBeenCalled()
  })
})
