'use client'

import { Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { datesLosingItems, dayParts, listDates } from '@/lib/schedule'
import type { Change } from '@/lib/state'
import { updateTrip } from '@/lib/store'
import type { Item, Trip } from '@/lib/types'
import { useAction } from '@/lib/useAction'
import { Field, Sheet, inputClass, primaryClass } from './ui'

export function TripForm({
  trip,
  items,
  apply,
  onClose,
}: {
  trip: Trip
  items: Item[]
  apply: (change: Change) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(trip.title)
  const [start, setStart] = useState(trip.start_date)
  const [end, setEnd] = useState(trip.end_date)
  const { pending, error, run } = useAction()

  // 擋下來的原因；沒有問題時是 null
  let blocked: string | null = null
  if (listDates(start, end).length === 0) {
    blocked = '回程日不能早於出發日'
  } else {
    const lost = datesLosingItems(items, start, end)
    if (lost.length > 0) {
      blocked = `先把 ${lost.map((d) => dayParts(d).md).join('、')} 的行程移走或刪掉`
    }
  }

  return (
    <Sheet title="編輯旅程" onClose={onClose} busy={pending}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (blocked || !title.trim()) return
          void run(async () => {
            const row = await updateTrip({ title: title.trim(), start_date: start, end_date: end })
            apply({ table: 'trip', eventType: 'UPDATE', new: row, old: null })
            onClose()
          })
        }}
      >
        <Field label="旅程名稱">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={30}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="出發日">
            <input
              type="date"
              className={inputClass}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
            />
          </Field>
          <Field label="回程日">
            <input
              type="date"
              className={inputClass}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </Field>
        </div>
        {blocked && (
          <p role="alert" className="text-sm text-red-700">
            {blocked}
          </p>
        )}
        <button
          type="submit"
          className={primaryClass}
          disabled={pending || !!blocked || !title.trim()}
        >
          {pending ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />}
          {pending ? '儲存中…' : '儲存'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  )
}
