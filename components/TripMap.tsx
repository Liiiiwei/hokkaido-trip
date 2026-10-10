'use client'

import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { overviewOf } from '@/lib/maps'
import { dayLabel, dayParts } from '@/lib/schedule'
import type { Day, Item } from '@/lib/types'
import { MapLegend, MapView, type MapMarker } from './MapView'
import { Sheet, ghostClass } from './ui'

// 全程地圖：所有天的地點與住宿放在同一張圖，可以只看某一天
export function TripMap({
  items,
  days,
  onPickDay,
  onClose,
}: {
  items: Item[]
  days: Day[]
  onPickDay: (date: string) => void
  onClose: () => void
}) {
  const { groups, stays } = overviewOf(items, days)
  const dates = [...new Set([...groups.map((g) => g.date), ...stays.flatMap((s) => s.dates)])].sort()
  const [only, setOnly] = useState<string | null>(null)
  const picked = only && dates.includes(only) ? only : null

  const shownGroups = picked ? groups.filter((g) => g.date === picked) : groups
  const shownStays = picked ? stays.filter((s) => s.dates.includes(picked)) : stays
  const nights = (list: string[]) => list.map((d) => dayParts(d).md).join('、')
  const markers: MapMarker[] = [
    ...shownStays.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      kind: 'stay' as const,
      text: '',
      title: `住宿：${s.title}（${nights(s.dates)}）`,
    })),
    ...shownGroups.flatMap((g) =>
      g.stops.map((p) => ({
        lat: p.lat,
        lng: p.lng,
        kind: 'stop' as const,
        // 看全部時圖釘寫日期，只看一天時寫當天的順序
        text: picked ? String(p.n) : dayParts(g.date).md,
        title: `${dayParts(g.date).md} · ${p.n}. ${p.title}`,
      })),
    ),
  ]
  const chip = (active: boolean) =>
    `h-9 shrink-0 rounded-full border px-3 text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      active
        ? 'border-accent bg-accent font-semibold text-white'
        : 'border-zinc-300 bg-white text-zinc-700 active:bg-zinc-100'
    }`

  return (
    <Sheet title="全程地圖" onClose={onClose} swipeToClose>
      {markers.length === 0 && !picked ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          還沒有定位過的地點。編輯行程或住宿時按「找地點」，這裡就會出現。
        </p>
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3">
            <button
              type="button"
              aria-pressed={!picked}
              className={chip(!picked)}
              onClick={() => setOnly(null)}
            >
              全部
            </button>
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={picked === d}
                className={chip(picked === d)}
                onClick={() => setOnly(d)}
              >
                {dayParts(d).md}
              </button>
            ))}
          </div>
          <MapView
            markers={markers}
            lines={shownGroups.map((g) => g.stops.map((p) => [p.lat, p.lng]))}
            heightClass="h-[44dvh]"
          />
          <MapLegend stopLabel={picked ? '行程順序' : '行程（數字是日期）'} />

          <ul className="mt-3 space-y-3">
            {shownGroups.map((g) => (
              <li key={g.date}>
                <div className="text-xs font-semibold text-zinc-600">{dayLabel(g.date)}</div>
                <ol className="mt-1 space-y-0.5 text-sm text-zinc-700">
                  {g.stops.map((p) => (
                    <li key={p.id} className="flex gap-2">
                      <span className="w-4 shrink-0 text-right tabular-nums text-zinc-400">{p.n}</span>
                      <span className="min-w-0 break-words">{p.title}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
            {shownStays.length > 0 && (
              <li>
                <div className="text-xs font-semibold text-zinc-600">住宿</div>
                <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
                  {shownStays.map((s) => (
                    <li key={`${s.lat},${s.lng}`} className="break-words">
                      {s.title}
                      <span className="ml-1 text-zinc-400">{nights(s.dates)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>

          {picked && (
            <button
              type="button"
              className={`${ghostClass} mt-4 w-full`}
              onClick={() => onPickDay(picked)}
            >
              看 {dayParts(picked).md} 的行程
              <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
    </Sheet>
  )
}
