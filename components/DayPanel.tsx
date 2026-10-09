'use client'

import { BedDouble, CalendarPlus, ChevronDown, ChevronUp, Map as MapIcon, Pencil } from 'lucide-react'
import { useState } from 'react'
import { pinsOf, prevDate, previousStop, stayPinsOf, staySpot } from '@/lib/maps'
import { buildBlocks, dayLabel, filterMine, membersOf } from '@/lib/schedule'
import type { Change } from '@/lib/state'
import type { Item, TripData } from '@/lib/types'
import { ItemCard } from './ItemCard'
import { MapLegend, MapView, type MapMarker } from './MapView'
import { ghostClass } from './ui'

export function DayPanel({
  data,
  date,
  me,
  onlyMine,
  onToggleMine,
  onEditDay,
  onEditItem,
  onAdd,
  apply,
}: {
  data: TripData
  date: string
  me: string
  onlyMine: boolean
  onToggleMine: (value: boolean) => void
  onEditDay: () => void
  onEditItem: (item: Item) => void
  onAdd: () => void
  apply: (change: Change) => void
}) {
  const day = data.days.find((d) => d.date === date)
  const todays = data.items.filter((i) => i.day === date)
  const mine = filterMine(todays, data.itemMembers, me)
  const shown = onlyMine ? mine : todays
  const blocks = buildBlocks(shown)
  const pins = pinsOf(shown)
  const stays = stayPinsOf(data.days, date)
  // 當天第一站沒有上一站，就從早上出發的住宿（前一晚住的地方）算起
  const morning = staySpot(data.days.find((d) => d.date === prevDate(date)))
  const [mapOpen, setMapOpen] = useState(false)

  const markers: MapMarker[] = [
    ...stays.map((s) => ({ ...s, kind: 'stay' as const, text: '', title: `住宿：${s.title}` })),
    ...pins.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      kind: 'stop' as const,
      text: String(p.n),
      title: `${p.n}. ${p.title}`,
    })),
  ]
  const summary = [pins.length > 0 && `${pins.length} 個地點`, stays.length > 0 && '住宿']
    .filter(Boolean)
    .join('、')

  const card = (item: Item) => (
    <ItemCard
      key={item.id}
      item={item}
      members={membersOf(item.id, data.itemMembers)}
      me={me}
      pinNo={pins.find((p) => p.id === item.id)?.n}
      from={previousStop(mine, item) ?? morning}
      onEdit={onEditItem}
      apply={apply}
    />
  )

  return (
    <section className="px-4 pb-28 pt-3">
      <button
        type="button"
        onClick={onEditDay}
        aria-label={`編輯 ${dayLabel(date)} 的住宿與備註`}
        className="flex min-h-11 w-full items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors active:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <BedDouble size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-zinc-500">
            {dayLabel(date)} 住宿{day?.stay && day.city ? ` · ${day.city}` : ''}
          </span>
          <span
            className={`block break-words text-base font-semibold ${
              day?.stay || day?.city ? '' : 'text-zinc-400'
            }`}
          >
            {day?.stay || day?.city || '還沒填住哪裡'}
          </span>
          {day?.note && (
            <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-zinc-500">
              {day.note}
            </span>
          )}
        </span>
        <Pencil size={14} className="mt-1 shrink-0 text-zinc-400" />
      </button>

      <label className="mt-2 flex h-11 items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          className="h-5 w-5 accent-blue-700"
          checked={onlyMine}
          onChange={(e) => onToggleMine(e.target.checked)}
        />
        只看我的
      </label>

      {markers.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((open) => !open)}
            className="flex h-11 w-full items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition-colors active:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <MapIcon size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">當天地圖 · {summary}</span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-zinc-500">
              {mapOpen ? '收起' : '展開'}
              {mapOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>
          {mapOpen && (
            <div className="mt-2">
              <MapView markers={markers} lines={[pins.map((p) => [p.lat, p.lng])]} />
              <MapLegend stopLabel="行程順序" />
            </div>
          )}
        </>
      ) : (
        shown.length > 0 && (
          <p className="text-xs text-zinc-500">
            編輯行程時在地點旁按「找地點」，這天的地圖就會出現。
          </p>
        )
      )}

      {blocks.length === 0 ? (
        <div className="mt-8 flex flex-col items-center text-center">
          <CalendarPlus size={28} className="text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-500">
            {todays.length === 0 ? '這天還沒有行程' : '你這天沒有加入任何分開行程'}
          </p>
          {todays.length === 0 && (
            <button type="button" onClick={onAdd} className={`${ghostClass} mt-3`}>
              <CalendarPlus size={16} />
              新增第一個行程
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {blocks.map((block) =>
            block.type === 'all' ? (
              card(block.item)
            ) : (
              <div
                key={`split-${block.startTime ?? 'none'}-${block.items[0].id}`}
                className="rounded-2xl border border-dashed border-zinc-400 p-2"
              >
                <div className="px-1 pb-2 text-xs font-semibold text-zinc-600">
                  分開行動 · {block.startTime ?? '時間未定'}
                </div>
                <div className="space-y-2">{block.items.map(card)}</div>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  )
}
