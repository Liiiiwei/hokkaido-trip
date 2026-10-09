'use client'

import { useState } from 'react'
import { dayLabel } from '@/lib/schedule'
import type { Change } from '@/lib/state'
import { upsertDay } from '@/lib/store'
import type { Day } from '@/lib/types'
import { useAction } from '@/lib/useAction'
import { Field, Sheet, inputClass, primaryClass } from './ui'

export function DayForm({
  day,
  apply,
  onClose,
}: {
  day: Day
  apply: (change: Change) => void
  onClose: () => void
}) {
  const [city, setCity] = useState(day.city)
  const [note, setNote] = useState(day.note)
  const { pending, error, run } = useAction()

  return (
    <Sheet title={`${dayLabel(day.date)} 住宿與備註`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            const row = await upsertDay({ date: day.date, city: city.trim(), note: note.trim() })
            apply({ table: 'days', eventType: 'UPDATE', new: row, old: null })
            onClose()
          })
        }}
      >
        <Field label="當晚住的城市">
          <input
            className={inputClass}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={20}
            placeholder="例如：札幌"
          />
        </Field>
        <Field label="當天備註">
          <textarea
            className={`${inputClass} h-24 py-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
          />
        </Field>
        <button type="submit" className={primaryClass} disabled={pending}>
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
