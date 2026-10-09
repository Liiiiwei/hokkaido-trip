import { describe, expect, it } from 'vitest'
import { singleFlight } from './singleFlight'

describe('singleFlight', () => {
  it('進行中再呼叫會被忽略，結束後可以再跑', async () => {
    const run = singleFlight()
    let count = 0
    let release = () => {}
    const slow = () =>
      new Promise<void>((resolve) => {
        count += 1
        release = resolve
      })
    const first = run(slow)
    const second = run(slow)
    expect(count).toBe(1)
    release()
    await Promise.all([first, second])
    await run(async () => {
      count += 1
    })
    expect(count).toBe(2)
  })
  it('失敗後可以再試', async () => {
    const run = singleFlight()
    await expect(
      run(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    let ran = false
    await run(async () => {
      ran = true
    })
    expect(ran).toBe(true)
  })
})
