'use client'

import { Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { dayLabel } from '@/lib/schedule'
import type { Change } from '@/lib/state'
import { upsertDay } from '@/lib/store'
import type { Day } from '@/lib/types'
import { useAction } from '@/lib/useAction'
import { LinkPreview } from './LinkPreview'
import { PlacePicker, type Picked } from './PlacePicker'
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
  const [stay, setStay] = useState(day.stay ?? '')
  const [note, setNote] = useState(day.note)
  const [pin, setPin] = useState<Picked | null>(
    typeof day.lat === 'number' && typeof day.lng === 'number'
      ? { lat: day.lat, lng: day.lng, label: '' }
      : null,
  )
  const { pending, error, run } = useAction()

  return (
    <Sheet title={`${dayLabel(day.date)} 住宿與備註`} onClose={onClose} busy={pending}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            const row = await upsertDay({
              date: day.date,
              city: city.trim(),
              note: note.trim(),
              stay: stay.trim(),
              lat: pin?.lat ?? null,
              lng: pin?.lng ?? null,
            })
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
        <Field label="住宿名稱">
          <input
            className={inputClass}
            value={stay}
            onChange={(e) => {
              // 名稱改了，原本的定位就不一定對，清掉讓人重找
              setStay(e.target.value)
              setPin(null)
            }}
            maxLength={80}
            placeholder="飯店或民宿的名字"
          />
        </Field>
        <PlacePicker key={stay} query={stay} pin={pin} onPin={setPin} disabled={pending} />
        <Field label="當天備註">
          <textarea
            className={`${inputClass} h-24 py-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
          />
        </Field>
        <LinkPreview text={note} />
        <button type="submit" className={primaryClass} disabled={pending}>
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
