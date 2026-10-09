import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './id'

afterEach(() => vi.unstubAllGlobals())

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('每次都不一樣', () => {
    expect(newId()).toMatch(UUID)
    expect(newId()).not.toBe(newId())
  })
  it('舊瀏覽器沒有 randomUUID 時也產生得出來', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(newId()).toMatch(UUID)
    expect(newId()).not.toBe(newId())
  })
})
