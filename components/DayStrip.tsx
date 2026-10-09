'use client'

import { useEffect, useRef } from 'react'
import { dayParts } from '@/lib/schedule'
import type { Day } from '@/lib/types'

export function DayStrip({
  dates,
  days,
  current,
  onSelect,
}: {
  dates: string[]
  days: Day[]
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
        return (
          <button
            key={date}
            ref={active ? activeRef : undefined}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(date)}
            className={`min-w-16 shrink-0 rounded-xl border px-3 py-2 text-center ${
              active
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-zinc-200 bg-white text-zinc-900'
            }`}
          >
            <div className="text-sm font-semibold tabular-nums">{md}</div>
            <div className="text-xs opacity-80">週{weekday}</div>
            <div className="mt-1 h-4 max-w-20 truncate text-xs opacity-80">{city}</div>
          </button>
        )
      })}
    </nav>
  )
}
