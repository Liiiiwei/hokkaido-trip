'use client'

import { X } from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { rubberband, shouldDismiss, springAt, velocityOf, type Sample } from '@/lib/gesture'

// 用鍵盤操作時看得到焦點；按下去的回饋在 globals.css
const press =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export const inputClass =
  'h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none transition-colors focus:border-accent'

export const primaryClass = `inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-signal px-4 text-base font-semibold text-white active:bg-signal-deep disabled:opacity-50 ${press}`

export const ghostClass = `inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 text-sm text-zinc-700 active:bg-zinc-100 disabled:opacity-50 ${press}`

// 面板要收起時先播完離開的動作，再真的拿掉
const SheetPresence = createContext<{ closing: boolean; onExited: () => void } | null>(null)

export function SheetHost({
  closing,
  onExited,
  children,
}: {
  closing: boolean
  onExited: () => void
  children: ReactNode
}) {
  return <SheetPresence.Provider value={{ closing, onExited }}>{children}</SheetPresence.Provider>
}

// 面板大約多久到位（秒）
const RESPONSE = 0.36
// 手指動超過這個距離才算拖曳，避免點一下也被當成拖
const SLOP = 10

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// 從底部滑出的面板，進出走同一條路。
// 表單面板只有「關閉」能收起：手機上很容易誤觸，打到一半的內容會不見；
// 往下拖只會被拉住再彈回去。swipeToClose 的面板（沒有可遺失的內容）才能拖到收起。
// busy 時不能關，否則存檔失敗的訊息會看不到
export function Sheet({
  title,
  onClose,
  busy = false,
  swipeToClose = false,
  children,
}: {
  title: string
  onClose: () => void
  busy?: boolean
  swipeToClose?: boolean
  children: ReactNode
}) {
  const presence = useContext(SheetPresence)
  const panel = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  // 目前位移、速度、高度、進行中的動畫
  const motion = useRef({ y: 0, v: 0, height: 1, raf: 0 })
  const drag = useRef<{ startY: number; startOffset: number; active: boolean; samples: Sample[] } | null>(
    null,
  )

  const paint = (y: number) => {
    const m = motion.current
    m.y = y
    if (panel.current) panel.current.style.transform = `translate3d(0, ${y}px, 0)`
    if (scrim.current) {
      scrim.current.style.opacity = String(Math.min(1, Math.max(0, 1 - y / m.height)))
    }
  }

  // 一律從畫面上現在的位置出發，所以動到一半被抓住或改方向都不會跳
  const animateTo = (target: number, velocity: number, done?: () => void) => {
    const m = motion.current
    cancelAnimationFrame(m.raf)
    if (reducedMotion()) {
      paint(target)
      m.v = 0
      done?.()
      return
    }
    const x0 = m.y - target
    const started = performance.now()
    const tick = (now: number) => {
      const { x, v } = springAt(x0, velocity, RESPONSE, (now - started) / 1000)
      m.v = v
      if (Math.abs(x) < 0.5 && Math.abs(v) < 5) {
        paint(target)
        m.v = 0
        done?.()
        return
      }
      paint(target + x)
      m.raf = requestAnimationFrame(tick)
    }
    m.raf = requestAnimationFrame(tick)
  }

  // 進場：從面板自己的高度滑上來
  useLayoutEffect(() => {
    const m = motion.current
    m.height = panel.current?.offsetHeight || 1
    if (!reducedMotion()) paint(m.height)
    animateTo(0, 0)
    return () => cancelAnimationFrame(m.raf)
    // 只在掛上時跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 離場：沿原路滑下去，帶著放手時的速度
  const closing = presence?.closing ?? false
  useEffect(() => {
    if (!closing || !presence) return
    const m = motion.current
    animateTo(m.height, m.v, presence.onExited)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

  const canDismiss = swipeToClose && !busy

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    // 動到一半被抓住：停在現在的位置，接著跟手
    cancelAnimationFrame(motion.current.raf)
    // 一按下就把這根手指的事件都留在把手上，滑出把手範圍也繼續跟
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      startY: event.clientY,
      startOffset: motion.current.y,
      active: false,
      samples: [],
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dy = event.clientY - d.startY
    if (!d.active) {
      if (Math.abs(dy) < SLOP) return
      d.active = true
    }
    const { height } = motion.current
    const raw = d.startOffset + dy
    // 往上、或不能收起的面板往下：越拉越緊
    const y = raw < 0 ? rubberband(raw, height) : canDismiss ? raw : rubberband(raw, height)
    paint(y)
    d.samples.push({ t: event.timeStamp, y })
    if (d.samples.length > 8) d.samples.shift()
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const m = motion.current
    if (!d.active) {
      // 只是點一下：如果剛才打斷了動畫，讓它回到位
      if (m.y !== 0) animateTo(0, 0)
      return
    }
    const velocity = velocityOf(d.samples, event.timeStamp)
    if (canDismiss && shouldDismiss({ offset: m.y, velocity, height: m.height })) {
      m.v = velocity
      onClose()
      return
    }
    animateTo(0, velocity)
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center sm:items-center">
      <div ref={scrim} aria-hidden="true" className="sheet-scrim absolute inset-0 bg-black/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-panel relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0_0_0/0.12)] sm:rounded-2xl"
      >
        {/* 標題列黏在上面：內容再長，「關閉」都按得到；也是拖曳的把手 */}
        <div
          data-sheet-handle
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className="sticky -top-4 z-10 -mx-4 -mt-4 mb-3 flex touch-none select-none items-center justify-between bg-white px-4 pb-1 pt-3 before:absolute before:left-1/2 before:top-1.5 before:h-1 before:w-9 before:-translate-x-1/2 before:rounded-full before:bg-zinc-300 sm:before:hidden"
        >
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`-mr-2 inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm text-zinc-600 active:bg-zinc-100 disabled:opacity-50 ${press}`}
          >
            <X size={16} />
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-600">{label}</span>
      {children}
    </label>
  )
}
