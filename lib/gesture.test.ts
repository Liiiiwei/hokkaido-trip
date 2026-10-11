import { describe, expect, it } from 'vitest'
import {
  axisOf,
  dayStep,
  project,
  reorderPreview,
  rubberband,
  settleReveal,
  shouldDismiss,
  springAt,
  velocityOf,
} from './gesture'

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

describe('axisOf', () => {
  it('動得還不夠遠時不判斷', () => {
    expect(axisOf(4, 6)).toBeNull()
  })

  it('橫向明顯比較多才算橫滑，斜著滑留給上下捲', () => {
    expect(axisOf(-30, 5)).toBe('x')
    expect(axisOf(14, 13)).toBe('y')
    expect(axisOf(3, 40)).toBe('y')
  })
})

describe('settleReveal', () => {
  it('拉過一半就停在露出的位置，不到一半收回去', () => {
    expect(settleReveal({ offset: -90, velocity: 0, width: 144 })).toBe(-144)
    expect(settleReveal({ offset: -40, velocity: 0, width: 144 })).toBe(0)
  })

  it('輕輕一甩也算：看預估會停在哪', () => {
    expect(settleReveal({ offset: -20, velocity: -400, width: 144 })).toBe(-144)
    expect(settleReveal({ offset: -120, velocity: 600, width: 144 })).toBe(0)
  })
})

describe('dayStep', () => {
  it('往左滑夠遠是下一天，往右是上一天，不夠遠不換', () => {
    expect(dayStep({ offset: -180, velocity: 0, width: 390 })).toBe(1)
    expect(dayStep({ offset: 180, velocity: 0, width: 390 })).toBe(-1)
    expect(dayStep({ offset: -60, velocity: 0, width: 390 })).toBe(0)
  })

  it('短短一甩也會換', () => {
    expect(dayStep({ offset: -30, velocity: -500, width: 390 })).toBe(1)
  })
})

describe('reorderPreview', () => {
  // 三張高度不同的卡片，間距 12
  const boxes = [
    { top: 0, height: 100 },
    { top: 112, height: 60 },
    { top: 184, height: 80 },
  ]

  it('沒拖過別人的中線就留在原位', () => {
    expect(reorderPreview(boxes, 0, 40)).toEqual({ to: 0, shifts: [0, 0, 0], settle: 0 })
  })

  it('往下拖過下一張的中線：那一張往上讓出自己的高度加間距', () => {
    const r = reorderPreview(boxes, 0, 100)
    expect(r.to).toBe(1)
    expect(r.shifts).toEqual([0, -112, 0])
    // 落點：第二張讓上去後，自己的底對齊它原本的底
    expect(r.settle).toBe(72)
  })

  it('一路拖到最後', () => {
    const r = reorderPreview(boxes, 0, 200)
    expect(r.to).toBe(2)
    expect(r.shifts).toEqual([0, -112, -112])
    expect(r.settle).toBe(164)
  })

  it('往上拖：被越過的往下讓，自己落在對方原本的位置', () => {
    const r = reorderPreview(boxes, 2, -180)
    expect(r.to).toBe(0)
    expect(r.shifts).toEqual([92, 92, 0])
    expect(r.settle).toBe(-184)
  })
})
