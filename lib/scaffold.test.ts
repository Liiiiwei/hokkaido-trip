import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('骨架殘留', () => {
  it('public/ 裡沒有用不到的預設圖示', () => {
    const leftovers = ['file.svg', 'globe.svg', 'next.svg', 'vercel.svg', 'window.svg']
    const found = leftovers.filter((name) => existsSync(path.join(__dirname, '..', 'public', name)))
    expect(found).toEqual([])
  })
})
