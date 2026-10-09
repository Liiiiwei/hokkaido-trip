'use client'

import { useState } from 'react'
import { pinsOf, previousStop } from '@/lib/maps'
import { buildBlocks, dayLabel, filterMine, membersOf } from '@/lib/schedule'
import type { Change } from '@/lib/state'
import type { Item, TripData } from '@/lib/types'
import { DayMap } from './DayMap'
import { ItemCard } from './ItemCard'
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
  const [mapOpen, setMapOpen] = useState(false)

  const card = (item: Item) => (
    <ItemCard
      key={item.id}
      item={item}
      members={membersOf(item.id, data.itemMembers)}
      me={me}
      pinNo={pins.find((p) => p.id === item.id)?.n}
      from={previousStop(mine, item)}
      onEdit={onEditItem}
      apply={apply}
    />
  )

  return (
    <section className="px-4 pb-28 pt-3">
      <button
        type="button"
        onClick={onEditDay}
        aria-label={`編輯 ${dayLabel(date)} 的城市與備註`}
        className="block min-h-11 w-full rounded-xl border border-zinc-200 bg-white p-3 text-left"
      >
        <div className="text-xs text-zinc-500">{dayLabel(date)} 住宿</div>
        <div className={`text-base font-semibold ${day?.city ? '' : 'text-zinc-400'}`}>
          {day?.city || '還沒填住哪裡'}
        </div>
        {day?.note && (
          <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-500">{day.note}</div>
        )}
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

      {pins.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((open) => !open)}
            className={`${ghostClass} flex w-full items-center justify-between`}
          >
            <span>當天地圖 · {pins.length} 個地點</span>
            <span className="text-zinc-500">{mapOpen ? '收起' : '展開'}</span>
          </button>
          {mapOpen && <DayMap pins={pins} />}
        </>
      ) : (
        shown.length > 0 && (
          <p className="text-xs text-zinc-500">
            編輯行程時在地點旁按「找地點」，這天的地圖就會出現。
          </p>
        )
      )}

      {blocks.length === 0 ? (
        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-500">
            {todays.length === 0 ? '這天還沒有行程' : '你這天沒有加入任何分開行程'}
          </p>
          {todays.length === 0 && (
            <button type="button" onClick={onAdd} className={`${ghostClass} mt-3`}>
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
