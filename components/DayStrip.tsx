'use client'

import { useEffect, useRef } from 'react'
import { dayParts } from '@/lib/schedule'
import type { Day, Item } from '@/lib/types'

export function DayStrip({
  dates,
  days,
  items,
  current,
  onSelect,
}: {
  dates: string[]
  days: Day[]
  items: Item[]
  current: string
  onSelect: (date: string) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)

  // 選到的那天捲到看得見的位置
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    activeRef.current?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [current])

  return (
    <nav aria-label="日期" className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2.5 [scrollbar-width:none]">
      {dates.map((date) => {
        const active = date === current
        const city = days.find((d) => d.date === date)?.city ?? ''
        const { md, weekday } = dayParts(date)
        const count = items.filter((i) => i.day === date).length
        return (
          <button
            key={date}
            ref={active ? activeRef : undefined}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(date)}
            className={`flex min-w-[4.25rem] shrink-0 flex-col items-center rounded-2xl border px-3 pb-2 pt-1.5 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${
              active
                ? 'border-signal bg-signal text-ink'
                : 'border-white/15 bg-white/[0.06] text-white active:bg-white/15'
            }`}
          >
            {/* 讀出來的順序是日期在前；畫面上星期排在日期上面 */}
            <div className="font-mono text-lg font-semibold leading-tight tracking-tight">{md}</div>
            <div
              className={`order-first text-[11px] ${active ? 'font-semibold' : 'text-white/60'}`}
            >
              週{weekday}
            </div>
            <div
              className={`h-4 max-w-20 truncate text-[11px] ${active ? '' : 'text-white/60'}`}
            >
              {city}
            </div>
            {/* 有排行程的日子底下有一個點，一眼看出哪幾天還空著 */}
            <div
              aria-hidden="true"
              className={`mt-1 h-1.5 w-1.5 rounded-full ${
                count === 0 ? 'bg-transparent' : active ? 'bg-ink' : 'bg-signal'
              }`}
            />
            <span className="sr-only">{count > 0 ? `${count} 個行程` : '還沒有行程'}</span>
          </button>
        )
      })}
    </nav>
  )
}
