// 手勢與彈簧的計算，全部是純函式

export type Sample = { t: number; y: number }

// 放手時的速度（每秒像素）會讓東西再滑多遠，和捲動慣性同一個算法
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

// 拉過邊界時越拉越緊，不是硬停
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (overshoot === 0) return 0
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

// 用最近 100 毫秒的軌跡算放手速度；now 比最後一點晚太多代表手指已經停住
export function velocityOf(samples: Sample[], now?: number): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  if (now !== undefined && now - last.t > 100) return 0
  const first = samples.find((s) => last.t - s.t <= 100) ?? samples[samples.length - 2]
  const dt = last.t - first.t
  if (dt <= 0) return 0
  return ((last.y - first.y) / dt) * 1000
}

// 放手後要不要收起：看預估會停在哪，不是看放手的位置；往上甩一律不收
export function shouldDismiss({
  offset,
  velocity,
  height,
}: {
  offset: number
  velocity: number
  height: number
}): boolean {
  if (velocity < -50) return false
  return offset + project(velocity) > height / 2
}

// 不會彈過頭的彈簧。x 是離目標的距離，response 是大約多久到位（秒）
export function springAt(
  x0: number,
  v0: number,
  response: number,
  t: number,
): { x: number; v: number } {
  const w = (2 * Math.PI) / response
  const c = v0 + w * x0
  const decay = Math.exp(-w * t)
  return { x: (x0 + c * t) * decay, v: (v0 - w * c * t) * decay }
}
