'use client'

import {
  BedDouble,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  Navigation,
  Pencil,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  driveLeg,
  googleTransitUrl,
  lastStop,
  pinsOf,
  prevDate,
  previousStop,
  stayPinsOf,
  staySpot,
} from '@/lib/maps'
import { buildBlocks, dayLabel, filterMine, membersOf } from '@/lib/schedule'
import type { Change } from '@/lib/state'
import type { Item, TripData } from '@/lib/types'
import { DriveNote } from './DriveNote'
import { ItemCard } from './ItemCard'
import { MapLegend, MapView, type MapMarker } from './MapView'
import { RichText } from './RichText'
import { ghostClass } from './ui'

const ring =
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

// 時間軸的一列：左邊是時間，中間是軌道上的節點，右邊是內容
function Row({
  start,
  end,
  gutter,
  hollow,
  index,
  children,
}: {
  // 左邊要放時間以外的東西時用（例如回住宿那一列的圖示）
  gutter?: ReactNode
  start: string | null
  end?: string | null
  // 分開行動用空心節點，和全員行程的實心節點用形狀區分
  hollow?: boolean
  index: number
  children: ReactNode
}) {
  return (
    <li
      className="rise grid grid-cols-[2.75rem_1fr] gap-x-5"
      style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
    >
      <div className="pt-3 text-right font-mono leading-tight">
        {gutter ? (
          gutter
        ) : start ? (
          <>
            <div className="text-sm font-semibold text-zinc-900">{start}</div>
            {end && <div className="text-xs text-zinc-400">{end}</div>}
          </>
        ) : (
          <div className="font-sans text-xs text-zinc-400">未定</div>
        )}
      </div>
      <div className="relative min-w-0">
        <span
          aria-hidden="true"
          className={`absolute -left-2.5 top-[1.05rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-zinc-900 ${
            hollow ? 'bg-paper' : 'bg-zinc-900'
          }`}
        />
        {children}
      </div>
    </li>
  )
}

export function DayPanel({
  data,
  date,
  me,
  onEditDay,
  onEditItem,
  onAdd,
  apply,
}: {
  data: TripData
  date: string
  me: string
  onEditDay: () => void
  onEditItem: (item: Item) => void
  onAdd: () => void
  apply: (change: Change) => void
}) {
  const day = data.days.find((d) => d.date === date)
  const todays = data.items.filter((i) => i.day === date)
  // 我會去的行程：全員的加上我加入的分開行程，用來算「怎麼去」的上一站
  const mine = filterMine(todays, data.itemMembers, me)
  const blocks = buildBlocks(todays)
  const pins = pinsOf(todays)
  const stays = stayPinsOf(data.days, date)
  // 當天第一站沒有上一站，就從早上出發的住宿（前一晚住的地方）算起
  const morning = staySpot(data.days.find((d) => d.date === prevDate(date)))
  // 回程：我當天的最後一站回到當晚的住宿
  const tonight = staySpot(day)
  const last = lastStop(mine)
  const back = tonight ? driveLeg(last, tonight) : null
  const [mapOpen, setMapOpen] = useState(true)

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
      <div
        data-testid="stay-card"
        className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white py-2.5 pl-3 pr-1"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <BedDouble size={18} />
        </span>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-xs text-zinc-500">
            <span className="font-mono">{dayLabel(date)}</span> 住宿
            {day?.stay && day.city ? ` · ${day.city}` : ''}
          </p>
          <p
            className={`break-words text-base font-semibold leading-snug ${
              day?.stay || day?.city ? '' : 'text-zinc-400'
            }`}
          >
            {day?.stay || day?.city || '還沒填住哪裡'}
          </p>
          {day?.note && <RichText text={day.note} className="mt-1 text-sm text-zinc-500" />}
        </div>
        <button
          type="button"
          onClick={onEditDay}
          aria-label={`編輯 ${dayLabel(date)} 的住宿與備註`}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 active:bg-zinc-100 ${ring}`}
        >
          <Pencil size={16} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {markers.length > 0 ? (
          <button
            type="button"
            aria-expanded={mapOpen}
            onClick={() => setMapOpen((open) => !open)}
            className={`flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-800 active:bg-zinc-100 ${ring}`}
          >
            <MapIcon size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">當天地圖 · {summary}</span>
            {mapOpen ? (
              <ChevronUp size={16} className="shrink-0 text-zinc-500" />
            ) : (
              <ChevronDown size={16} className="shrink-0 text-zinc-500" />
            )}
          </button>
        ) : (
          <p className="min-w-0 flex-1 text-xs leading-snug text-zinc-500">
            {todays.length > 0 ? '在行程的地點旁按「找地點」，這天的地圖就會出現。' : ''}
          </p>
        )}
      </div>
      {mapOpen && markers.length > 0 && (
        <div className="mt-2">
          <MapView markers={markers} lines={[pins.map((p) => [p.lat, p.lng])]} lockDragOnTouch />
          <MapLegend stopLabel="行程順序（卡片上的數字）" />
          {/* 只在觸控裝置顯示：手機上單指留給捲動頁面 */}
          <p className="mt-1 hidden text-xs text-zinc-500 [@media(pointer:coarse)]:block">
            單指滑動是捲頁面，雙指可以縮放地圖；要拖動地圖請開右上角的全程地圖。
          </p>
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <CalendarPlus size={28} className="text-zinc-300" />
          <p className="mt-2 text-sm text-zinc-500">這天還沒有行程</p>
          <button type="button" onClick={onAdd} className={`${ghostClass} mt-3`}>
            <CalendarPlus size={16} />
            新增第一個行程
          </button>
        </div>
      ) : (
        // key 帶日期：換一天時整條時間軸重新進場
        <ol
          key={date}
          className="relative mt-4 space-y-3 before:absolute before:bottom-3 before:left-[3.375rem] before:top-3 before:w-px before:bg-zinc-300"
        >
          {blocks.map((block, index) =>
            block.type === 'all' ? (
              <Row
                key={block.item.id}
                start={block.item.start_time}
                end={block.item.end_time}
                index={index}
              >
                {card(block.item)}
              </Row>
            ) : (
              <Row
                key={`split-${block.startTime ?? 'none'}-${block.items[0].id}`}
                start={block.startTime}
                hollow
                index={index}
              >
                <div className="rounded-2xl border border-dashed border-zinc-400 p-2">
                  <div className="px-1 pb-2 text-xs font-semibold text-zinc-600">
                    分開行動 · 選想去的加入
                  </div>
                  <div className="space-y-2">{block.items.map(card)}</div>
                </div>
              </Row>
            ),
          )}
          {tonight && last && (
            <Row
              start={null}
              index={blocks.length}
              gutter={
                <span className="flex justify-end pt-0.5 text-zinc-500">
                  <BedDouble size={16} />
                </span>
              }
            >
              <div
                data-testid="return-leg"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
              >
                <p className="text-xs text-zinc-500">回住宿</p>
                <p className="break-words text-sm font-semibold">{tonight.title}</p>
                {back && (
                  <DriveNote fromTitle={last.title} from={back.from} to={back.to} className="mt-1" />
                )}
                <a
                  href={googleTransitUrl(last, tonight)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`怎麼去：從「${last.title}」回住宿`}
                  className={`mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-800 active:bg-zinc-100 ${ring}`}
                >
                  <Navigation size={16} />
                  怎麼去
                </a>
              </div>
            </Row>
          )}
          {pins.length > 0 && (
            <li className="pl-[3.9rem] text-xs leading-snug text-zinc-500">
              車程是開車的估計。電車、巴士的班次與搭車地點請按「怎麼去」。
            </li>
          )}
        </ol>
      )}
    </section>
  )
}
