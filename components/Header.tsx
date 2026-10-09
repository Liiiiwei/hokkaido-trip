'use client'

import { Map as MapIcon, Pencil, User } from 'lucide-react'
import { dayLabel } from '@/lib/schedule'
import type { Trip } from '@/lib/types'

const ring =
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function Header({
  trip,
  me,
  onEditTrip,
  onOpenMap,
  onRename,
}: {
  trip: Trip
  me: string
  onEditTrip: () => void
  onOpenMap: () => void
  onRename: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3">
      <button
        type="button"
        onClick={onEditTrip}
        className={`min-h-11 min-w-0 flex-1 rounded-lg text-left ${ring}`}
        aria-label="編輯旅程"
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-lg font-semibold">{trip.title}</span>
          <Pencil size={14} className="shrink-0 text-zinc-400" />
        </span>
        <span className="block font-mono text-xs text-zinc-500">
          {dayLabel(trip.start_date)} – {dayLabel(trip.end_date)}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenMap}
        aria-label="全程地圖"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 active:bg-zinc-100 ${ring}`}
      >
        <MapIcon size={18} />
      </button>
      <button
        type="button"
        onClick={onRename}
        aria-label={`目前身分 ${me}，點此改名`}
        className={`inline-flex h-11 max-w-[34%] shrink-0 items-center gap-1.5 rounded-full border border-zinc-300 px-3 text-sm active:bg-zinc-100 ${ring}`}
      >
        <User size={16} className="shrink-0 text-zinc-500" />
        <span className="truncate">{me}</span>
      </button>
    </div>
  )
}
