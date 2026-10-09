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
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [current])

  return (
    <nav aria-label="日期" className="flex gap-2 overflow-x-auto px-4 py-3">
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
            className={`min-w-16 shrink-0 rounded-xl border px-3 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active
                ? 'border-accent bg-accent text-white'
                : 'border-zinc-200 bg-white text-zinc-900 active:bg-zinc-100'
            }`}
          >
            <div className="font-mono text-sm font-semibold">{md}</div>
            <div className="text-xs opacity-80">週{weekday}</div>
            <div className="mt-1 h-4 max-w-20 truncate text-xs opacity-80">{city}</div>
            {/* 有排行程的日子底下有一條線，一眼看出哪幾天還空著 */}
            <div
              aria-hidden="true"
              className={`mx-auto mt-1.5 h-0.5 w-5 rounded-full ${
                count === 0 ? 'bg-transparent' : active ? 'bg-white' : 'bg-zinc-900'
              }`}
            />
            <span className="sr-only">{count > 0 ? `${count} 個行程` : '還沒有行程'}</span>
          </button>
        )
      })}
    </nav>
  )
}
