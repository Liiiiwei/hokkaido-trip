'use client'

import { useState } from 'react'
import { messageOf } from '@/lib/errors'
import { searchPlaces, type PlaceResult } from '@/lib/geocode'
import { dayLabel } from '@/lib/schedule'
import { newId } from '@/lib/id'
import { changedFields, type Change } from '@/lib/state'
import { createItem, deleteItem, updateItem } from '@/lib/store'
import type { Item, ItemInput, ItemKind } from '@/lib/types'
import { useAction } from '@/lib/useAction'
import { Field, Sheet, ghostClass, inputClass, primaryClass } from './ui'

export function ItemForm({
  item,
  defaultDay,
  dates,
  me,
  apply,
  onClose,
}: {
  item: Item | null
  defaultDay: string
  dates: string[]
  me: string
  apply: (change: Change) => void
  onClose: () => void
}) {
  const [day, setDay] = useState(item?.day ?? defaultDay)
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? 'all')
  const [start, setStart] = useState(item?.start_time ?? '')
  const [end, setEnd] = useState(item?.end_time ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [place, setPlace] = useState(item?.place ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  // 定位：座標加上給人看的說明
  const [pin, setPin] = useState<{ lat: number; lng: number; label: string } | null>(
    typeof item?.lat === 'number' && typeof item?.lng === 'number'
      ? { lat: item.lat, lng: item.lng, label: '' }
      : null,
  )
  const [found, setFound] = useState<PlaceResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [confirming, setConfirming] = useState(false)
  // 新行程的代號在表單開啟時就定下來，重試儲存也是同一筆
  const [freshId] = useState(newId)
  const save = useAction()
  const remove = useAction()
  const busy = save.pending || remove.pending

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const input: ItemInput = {
      day,
      kind,
      start_time: start || null,
      end_time: end || null,
      title: title.trim(),
      place: place.trim(),
      note: note.trim(),
      lat: pin?.lat ?? null,
      lng: pin?.lng ?? null,
    }
    if (!input.title) return
    void save.run(async () => {
      const row = item
        ? await updateItem(item.id, changedFields(item, input))
        : await createItem(input, me, freshId)
      apply({ table: 'items', eventType: item ? 'UPDATE' : 'INSERT', new: row, old: null })
      onClose()
    })
  }

  // 地點文字改了，原本的定位就不一定對，清掉讓人重找
  function onPlaceChange(value: string) {
    setPlace(value)
    setPin(null)
    setFound(null)
    setSearchError('')
  }

  async function onSearch() {
    if (searching) return
    setSearching(true)
    setSearchError('')
    setFound(null)
    try {
      setFound(await searchPlaces(place))
    } catch (error) {
      setSearchError(messageOf(error))
    } finally {
      setSearching(false)
    }
  }

  function onDelete() {
    if (!item) return
    // 第一次按只是進入確認，第二次才真的刪
    if (!confirming) {
      setConfirming(true)
      return
    }
    void remove.run(async () => {
      await deleteItem(item.id)
      apply({ table: 'items', eventType: 'DELETE', new: null, old: { id: item.id } })
      onClose()
    })
  }

  return (
    <Sheet title={item ? '編輯行程' : '新增行程'} onClose={onClose} busy={busy}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="日期">
          <select className={inputClass} value={day} onChange={(e) => setDay(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="mb-1 text-sm text-zinc-600">類型</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['all', '全員一起'],
                ['split', '分開行動'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex h-11 items-center justify-center gap-2 rounded-lg border text-sm ${
                  kind === value ? 'border-blue-700 font-semibold text-blue-700' : 'border-zinc-300'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  className="accent-blue-700"
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <Field label="開始時間">
            <input
              type="time"
              className={inputClass}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="結束時間">
            <input
              type="time"
              className={inputClass}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>

        <Field label="標題">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            required
          />
        </Field>
        <Field label="地點">
          <input
            className={inputClass}
            value={place}
            onChange={(e) => onPlaceChange(e.target.value)}
            maxLength={80}
          />
        </Field>
        <div className="space-y-2">
          {pin ? (
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 text-sm text-zinc-700">
                <span className="font-semibold text-blue-700">已定位</span>
                {pin.label && <span className="ml-1 break-words text-zinc-500">{pin.label}</span>}
              </p>
              <button
                type="button"
                className={`${ghostClass} shrink-0`}
                disabled={busy}
                onClick={() => setPin(null)}
              >
                取消定位
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${ghostClass} w-full`}
              disabled={busy || searching || !place.trim()}
              onClick={onSearch}
            >
              {searching ? '搜尋中…' : '找地點'}
            </button>
          )}
          {!pin && !found && !searchError && (
            <p className="text-xs text-zinc-500">定位後會出現在當天地圖上；不定位也能儲存。</p>
          )}
          {searchError && (
            <p role="alert" className="text-sm text-red-700">
              {searchError}
            </p>
          )}
          {!pin && found && found.length === 0 && (
            <p className="text-sm text-zinc-600">
              找不到這個地點，換成日文或英文名稱再找一次。
            </p>
          )}
          {!pin && found && found.length > 0 && (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-300">
              {found.map((r) => (
                <li key={`${r.lat},${r.lng},${r.address}`}>
                  <button
                    type="button"
                    className="block min-h-11 w-full px-3 py-2 text-left"
                    onClick={() => {
                      setPin({ lat: r.lat, lng: r.lng, label: r.address })
                      setFound(null)
                    }}
                  >
                    <span className="block text-sm font-semibold">{r.name}</span>
                    <span className="block break-words text-xs text-zinc-500">{r.address}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Field label="備註">
          <textarea
            className={`${inputClass} h-24 py-2`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
        </Field>

        <button type="submit" className={primaryClass} disabled={busy || !title.trim()}>
          {save.pending ? '儲存中…' : '儲存'}
        </button>
        {save.error && (
          <p role="alert" className="text-sm text-red-700">
            {save.error}
          </p>
        )}

        {item && (
          <>
            <button type="button" className={`${ghostClass} w-full`} disabled={busy} onClick={onDelete}>
              {remove.pending ? '刪除中…' : confirming ? '確定刪除' : '刪除'}
            </button>
            {confirming && !remove.pending && (
              <p className="text-center text-sm text-zinc-600">
                刪掉後所有人都看不到，再按一次確定。
              </p>
            )}
            {remove.error && (
              <p role="alert" className="text-sm text-red-700">
                {remove.error}
              </p>
            )}
          </>
        )}
      </form>
    </Sheet>
  )
}
