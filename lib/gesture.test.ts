import { describe, expect, it } from 'vitest'
import { project, rubberband, shouldDismiss, springAt, velocityOf } from './gesture'

describe('project', () => {
  it('速度越快，預估停下的位置越遠', () => {
    expect(project(0)).toBe(0)
    expect(project(1000)).toBeGreaterThan(project(500))
    expect(project(1000)).toBeCloseTo(499, 0)
  })

  it('往回的速度得到往回的距離', () => {
    expect(project(-1000)).toBeCloseTo(-499, 0)
  })
})

describe('rubberband', () => {
  it('拉得越遠跟得越少，而且不會超過可拉的範圍', () => {
    const near = rubberband(50, 600)
    const far = rubberband(500, 600)
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(50)
    expect(far).toBeLessThan(500 * 0.55)
    expect(far).toBeGreaterThan(near)
  })

  it('沒有拉就不動', () => {
    expect(rubberband(0, 600)).toBe(0)
  })
})

describe('velocityOf', () => {
  it('用最近一小段軌跡算速度（每秒幾像素）', () => {
    const samples = [
      { t: 0, y: 0 },
      { t: 50, y: 50 },
      { t: 100, y: 100 },
    ]
    expect(velocityOf(samples)).toBeCloseTo(1000, 0)
  })

  it('停住一陣子才放手，速度算 0', () => {
    const samples = [
      { t: 0, y: 0 },
      { t: 50, y: 200 },
    ]
    expect(velocityOf(samples, 400)).toBe(0)
  })

  it('只有一個點時是 0', () => {
    expect(velocityOf([{ t: 0, y: 10 }])).toBe(0)
  })
})

describe('shouldDismiss', () => {
  it('拖過一半就收起', () => {
    expect(shouldDismiss({ offset: 320, velocity: 0, height: 600 })).toBe(true)
  })

  it('只拖一點點但往下甩，照預估停下的位置收起', () => {
    expect(shouldDismiss({ offset: 40, velocity: 1200, height: 600 })).toBe(true)
  })

  it('拖一點點就放手，彈回去', () => {
    expect(shouldDismiss({ offset: 60, velocity: 0, height: 600 })).toBe(false)
  })

  it('拖過一半但放手時是往上甩，不收起', () => {
    expect(shouldDismiss({ offset: 340, velocity: -900, height: 600 })).toBe(false)
  })
})

describe('springAt', () => {
  it('從起點出發，最後停在目標上，中途不會衝過頭', () => {
    expect(springAt(300, 0, 0.35, 0).x).toBe(300)
    let previous = 300
    for (let t = 0.02; t <= 1; t += 0.02) {
      const { x } = springAt(300, 0, 0.35, t)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(previous)
      previous = x
    }
    expect(springAt(300, 0, 0.35, 1).x).toBeLessThan(0.5)
  })

  it('接手放手時的速度：一開始照原本的速度繼續走', () => {
    const { v } = springAt(100, 800, 0.35, 0)
    expect(v).toBe(800)
  })
})
