'use client'

import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { reorderPreview, type Box } from '@/lib/gesture'
import { buzz } from '@/lib/haptics'
import { reducedMotion } from '@/lib/motion'
import { moved } from '@/lib/schedule'

export type Sorter = {
  // 拿起一張卡片；ids 是同一組由前到後的順序。畫面上找不齊這一組就回 false
  begin: (id: string, ids: string[], clientY: number) => boolean
  move: (clientY: number) => void
  end: () => void
  cancel: () => void
}

// 拿起來之後最多可以拖出這一組的範圍多遠
const OVERSHOOT = 24
const SETTLE_MS = 200

type Live = {
  ids: string[]
  els: HTMLElement[]
  boxes: Box[]
  from: number
  to: number
  startY: number
  settle: number
}

// 把位移全部歸零，而且不要播歸位的動畫（順序已經換好了，再動一次會晃）
function reset(els: HTMLElement[]) {
  for (const el of els) {
    el.style.transition = 'none'
    el.style.transform = ''
    delete el.dataset.lifted
    delete el.dataset.settling
  }
  // 讓瀏覽器先套用「不要動畫」再拿掉，否則兩個設定會被併成一次
  void els[0]?.offsetHeight
  for (const el of els) el.style.transition = ''
}

// 同一組卡片的拖曳排序：拿起來的那張跟著手指，其他張即時讓位，放手後回報新順序
function createSorter() {
  const live: { current: Live | null } = { current: null }
  // 放手時要呼叫的函式；每次畫面更新後換成最新的
  const drop: { current: (ids: string[]) => void } = { current: () => undefined }

  // 都用頁面座標算，拖的時候頁面捲動了也不會錯位
  const begin: Sorter['begin'] = (id, ids, clientY) => {
    const els = ids.map((one) =>
      document.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(one)}"]`),
    )
    const from = ids.indexOf(id)
    // 一次只拿一張；另一根手指再按別張不算
    if (live.current || from < 0 || els.some((el) => !el)) return false
    const found = els as HTMLElement[]
    live.current = {
      ids,
      els: found,
      boxes: found.map((el) => {
        const rect = el.getBoundingClientRect()
        return { top: rect.top + window.scrollY, height: rect.height }
      }),
      from,
      to: from,
      startY: clientY + window.scrollY,
      settle: 0,
    }
    found[from].dataset.lifted = ''
    found[from].style.transform = 'scale(1.02)'
    buzz(12)
    return true
  }

  const move: Sorter['move'] = (clientY) => {
    const s = live.current
    if (!s) return
    const self = s.boxes[s.from]
    const last = s.boxes[s.boxes.length - 1]
    const min = s.boxes[0].top - self.top - OVERSHOOT
    const max = last.top + last.height - self.height - self.top + OVERSHOOT
    const dy = Math.min(max, Math.max(min, clientY + window.scrollY - s.startY))
    const { to, shifts, settle } = reorderPreview(s.boxes, s.from, dy)
    s.els.forEach((el, i) => {
      if (i === s.from) el.style.transform = `translate3d(0, ${dy}px, 0) scale(1.02)`
      else el.style.transform = shifts[i] ? `translate3d(0, ${shifts[i]}px, 0)` : ''
    })
    if (to !== s.to) buzz(5)
    s.to = to
    s.settle = settle
  }

  const end: Sorter['end'] = () => {
    const s = live.current
    live.current = null
    if (!s) return
    const el = s.els[s.from]
    delete el.dataset.lifted
    el.dataset.settling = ''
    el.style.transform = `translate3d(0, ${s.settle}px, 0)`
    const finish = () => {
      // 先讓畫面照新順序排好，同一個畫格裡把位移歸零，才不會閃一下
      flushSync(() => {
        if (s.to !== s.from) drop.current(moved(s.ids, s.from, s.to))
      })
      reset(s.els)
    }
    if (reducedMotion()) finish()
    else window.setTimeout(finish, SETTLE_MS)
  }

  const cancel: Sorter['cancel'] = () => {
    const s = live.current
    live.current = null
    if (s) reset(s.els)
  }

  const sorter: Sorter = { begin, move, end, cancel }
  return {
    sorter,
    listen: (fn: (ids: string[]) => void) => {
      drop.current = fn
    },
  }
}

export function useReorder(onDrop: (ids: string[]) => void): Sorter {
  // 拖曳的控制器整個過程都是同一個
  const [handle] = useState(createSorter)
  useEffect(() => {
    handle.listen(onDrop)
  })
  return handle.sorter
}
