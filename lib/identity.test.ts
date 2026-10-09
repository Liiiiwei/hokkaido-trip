// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadKey,
  loadName,
  loadOnlyMine,
  normalizeName,
  parseKey,
  saveKey,
  saveName,
  saveOnlyMine,
} from './identity'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('normalizeName', () => {
  it('去掉前後空白與全形空白，中間多個空白併成一個', () => {
    expect(normalizeName('  小明  ')).toBe('小明')
    expect(normalizeName('\u3000阿\u3000\u3000華 ')).toBe('阿 華')
  })
  it('只有空白時回傳空字串', () => {
    expect(normalizeName(' \u3000 ')).toBe('')
  })
  it('最多 20 個字，不把表情符號切壞', () => {
    expect(Array.from(normalizeName('字'.repeat(30)))).toHaveLength(20)
    const out = normalizeName('😀'.repeat(25))
    expect(Array.from(out)).toHaveLength(20)
    expect(out).toBe('😀'.repeat(20))
  })
})

describe('裝置上的名字', () => {
  it('存了讀得回來', () => {
    expect(loadName()).toBeNull()
    saveName('小明')
    expect(loadName()).toBe('小明')
  })
  it('localStorage 不能用時，讀取當成沒有名字、寫入不丟錯', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadName()).toBeNull()
    expect(() => saveName('小明')).not.toThrow()
    expect(loadOnlyMine()).toBe(false)
    expect(() => saveOnlyMine(true)).not.toThrow()
  })
})

describe('鑰匙', () => {
  it('從網址的 #k= 取出權杖', () => {
    expect(parseKey('#k=tok_11ABC_def456')).toBe('tok_11ABC_def456')
    expect(parseKey('#k=abc123&utm=line')).toBe('abc123')
  })
  it('沒有或格式不對時回傳 null', () => {
    expect(parseKey('')).toBeNull()
    expect(parseKey('#')).toBeNull()
    expect(parseKey('#k=')).toBeNull()
    expect(parseKey('#other=abc')).toBeNull()
  })
  it('存了讀得回來', () => {
    expect(loadKey()).toBeNull()
    saveKey('abc123')
    expect(loadKey()).toBe('abc123')
  })
})

describe('只看我的開關', () => {
  it('預設關閉，存了讀得回來', () => {
    expect(loadOnlyMine()).toBe(false)
    saveOnlyMine(true)
    expect(loadOnlyMine()).toBe(true)
    saveOnlyMine(false)
    expect(loadOnlyMine()).toBe(false)
  })
})
