'use client'

import { dayLabel } from '@/lib/schedule'
import type { Trip } from '@/lib/types'

export function Header({
  trip,
  me,
  onEditTrip,
  onRename,
}: {
  trip: Trip
  me: string
  onEditTrip: () => void
  onRename: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-3">
      <button type="button" onClick={onEditTrip} className="min-h-11 text-left" aria-label="編輯旅程">
        <div className="text-lg font-semibold">{trip.title}</div>
        <div className="text-xs text-zinc-500">
          {dayLabel(trip.start_date)} – {dayLabel(trip.end_date)}
        </div>
      </button>
      <button
        type="button"
        onClick={onRename}
        aria-label={`目前身分 ${me}，點此改名`}
        className="h-11 max-w-[40%] shrink-0 truncate rounded-full border border-zinc-300 px-4 text-sm"
      >
        {me}
      </button>
    </div>
  )
}
