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

// 手指一開始往哪邊走。橫向要明顯比直向多才算橫滑，其餘留給頁面上下捲
export function axisOf(dx: number, dy: number, slop = 10): 'x' | 'y' | null {
  if (Math.abs(dx) < slop && Math.abs(dy) < slop) return null
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
}

// 卡片左滑放手後停在哪：-width 是露出後面的動作，0 是收回去
export function settleReveal({
  offset,
  velocity,
  width,
}: {
  offset: number
  velocity: number
  width: number
}): number {
  return offset + project(velocity) < -width / 2 ? -width : 0
}

// 左右滑換日：1 是下一天、-1 是上一天、0 是不換。看預估會停在哪，不是看放手的位置
export function dayStep({
  offset,
  velocity,
  width,
}: {
  offset: number
  velocity: number
  width: number
}): -1 | 0 | 1 {
  const end = offset + project(velocity)
  if (Math.abs(end) < width * 0.35) return 0
  return end < 0 ? 1 : -1
}

export type Box = { top: number; height: number }

// 拖曳調順序：第 from 個被往下拖了 dy 之後，會落在第幾個、其他人各要讓開多少、
// 放手後自己要移到哪（都是相對原位的位移）。每個的高度可以不一樣
export function reorderPreview(
  boxes: Box[],
  from: number,
  dy: number,
): { to: number; shifts: number[]; settle: number } {
  const mid = (b: Box) => b.top + b.height / 2
  const self = boxes[from]
  const gap = boxes.length > 1 ? boxes[1].top - (boxes[0].top + boxes[0].height) : 0
  const center = mid(self) + dy
  let to = from
  for (let i = from + 1; i < boxes.length && center > mid(boxes[i]); i++) to = i
  for (let i = from - 1; i >= 0 && center < mid(boxes[i]); i--) to = i
  const step = self.height + gap
  const shifts = boxes.map((_, i) => {
    if (i > from && i <= to) return -step
    if (i < from && i >= to) return step
    return 0
  })
  const settle =
    to > from
      ? boxes[to].top + boxes[to].height - self.height - self.top
      : boxes[to].top - self.top
  return { to, shifts, settle }
}
