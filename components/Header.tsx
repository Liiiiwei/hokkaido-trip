'use client'

import { Map as MapIcon, Pencil, User } from 'lucide-react'
import { dayLabel } from '@/lib/schedule'
import type { Trip } from '@/lib/types'

const ring =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal'

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
          <span className="truncate text-lg font-semibold tracking-tight">{trip.title}</span>
          <Pencil size={14} className="shrink-0 text-white/50" />
        </span>
        <span className="block font-mono text-xs text-white/60">
          {dayLabel(trip.start_date)} – {dayLabel(trip.end_date)}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenMap}
        aria-label="全程地圖"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white active:bg-white/20 ${ring}`}
      >
        <MapIcon size={18} />
      </button>
      <button
        type="button"
        onClick={onRename}
        aria-label={`目前身分 ${me}，點此改名`}
        className={`inline-flex h-11 max-w-[34%] shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-sm text-white active:bg-white/20 ${ring}`}
      >
        <User size={16} className="shrink-0 text-white/60" />
        <span className="truncate">{me}</span>
      </button>
    </div>
  )
}
