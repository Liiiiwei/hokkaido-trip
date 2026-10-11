'use client'

import {
  GripVertical,
  LoaderCircle,
  MapPin,
  Navigation,
  Pencil,
  PlaneLanding,
  Split,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { axisOf, rubberband, settleReveal, velocityOf, type Sample } from '@/lib/gesture'
import { buzz } from '@/lib/haptics'
import { driveLeg, googlePlaceUrl, googleTransitUrl, hasSpot, type StaySpot } from '@/lib/maps'
import type { Change } from '@/lib/state'
import { deleteItem, joinItem, leaveItem } from '@/lib/store'
import type { Item } from '@/lib/types'
import { useAction } from '@/lib/useAction'
import { DriveNote } from './DriveNote'
import { RichText } from './RichText'
import { ghostClass } from './ui'
import type { Sorter } from './useReorder'

const linkClass =
  'control inline-flex h-11 items-center justify-center gap-1.5 text-sm font-semibold text-ink active:bg-ink/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent'

// 左滑後露出的動作區有多寬（兩顆按鈕）
const REVEAL = 144
// 手指按住不動多久算長按
const HOLD_MS = 450

type Touch = {
  id: number
  x: number
  y: number
  base: number
  mode: 'idle' | 'swipe' | 'sort'
  samples: Sample[]
}

// 行程卡片。時間顯示在左邊的時間軸上，卡片本身只放內容與動作
export function ItemCard({
  item,
  members,
  me,
  pinNo,
  from,
  live,
  sort,
  onEdit,
  apply,
}: {
  item: Item
  members: string[]
  me: string
  // 今天的行程裡，這一筆是正在進行還是下一站
  live?: 'now' | 'next'
  // 可以和同一組的其他行程調先後時才有：這一組由前到後的代號
  sort?: { ids: string[]; sorter: Sorter }
  // 在當天地圖上的編號；沒定位就沒有
  pinNo?: number
  // 「怎麼去」的起點：我的上一站，當天第一站則是早上出發的住宿
  from: Item | StaySpot | null
  onEdit: (item: Item) => void
  apply: (change: Change) => void
}) {
  const { pending, error, run } = useAction()
  const remove = useAction()
  const joined = members.includes(me)
  const leg = driveLeg(from, item)

  const wrap = useRef<HTMLDivElement>(null)
  const face = useRef<HTMLElement>(null)
  const touch = useRef<Touch | null>(null)
  const hold = useRef(0)
  const offset = useRef(0)
  // 滑完或拖完放手時瀏覽器還會補一個點擊，要吃掉，不然會誤開連結
  const swallowClick = useRef(false)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const paint = (x: number) => {
    offset.current = x
    if (face.current) face.current.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
  }
  const settle = (x: number) => {
    if (wrap.current) delete wrap.current.dataset.dragging
    paint(x)
    setOpen(x < 0)
    if (x === 0) setConfirming(false)
  }

  // 露出動作時，碰別的地方或捲動頁面就收回去
  useEffect(() => {
    if (!open) return
    const close = () => settle(0)
    const outside = (event: Event) => {
      if (!wrap.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('scroll', close)
    }
    // settle 只碰 ref 與設定狀態的函式，每次畫面更新都一樣
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 長按拿起卡片之後，手指上下移動是在拖卡片，不能讓頁面跟著捲。
  // 這個要在瀏覽器決定捲動之前攔下來，所以直接掛在元素上
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const block = (event: TouchEvent) => {
      if (touch.current?.mode === 'sort' && event.cancelable) event.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  // 拖到一半卡片被拿掉（別人刪了這筆、換日）就收不到放手的事件，要自己把其他卡片歸位
  const sorterRef = useRef(sort?.sorter)
  useEffect(() => {
    sorterRef.current = sort?.sorter
  })
  useEffect(
    () => () => {
      window.clearTimeout(hold.current)
      if (touch.current?.mode === 'sort') sorterRef.current?.cancel()
    },
    [],
  )

  const startSort = () => {
    const t = touch.current
    if (!t || t.mode !== 'idle' || !sort) return
    if (!sort.sorter.begin(item.id, sort.ids, t.y)) return
    t.mode = 'sort'
    swallowClick.current = true
    wrap.current?.setPointerCapture(t.id)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false
    // 滑鼠用卡片上的編輯鈕就好；手勢只給手指和觸控筆
    if (event.pointerType === 'mouse' || touch.current) return
    const target = event.target as HTMLElement
    if (target.closest('[data-card-actions]')) return
    touch.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      base: offset.current,
      mode: 'idle',
      samples: [],
    }
    if (!sort || open) return
    // 握把一碰就拿起來；卡片其他地方要長按。按鈕和連結按久一點仍然是按它，不算長按卡片
    if (target.closest('[data-grip]')) startSort()
    else if (!target.closest('button, a')) hold.current = window.setTimeout(startSort, HOLD_MS)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const t = touch.current
    if (!t || event.pointerId !== t.id) return
    if (t.mode === 'sort') {
      sort?.sorter.move(event.clientY)
      return
    }
    const dx = event.clientX - t.x
    if (t.mode === 'idle') {
      const axis = axisOf(dx, event.clientY - t.y)
      if (!axis) return
      window.clearTimeout(hold.current)
      if (axis === 'y') {
        // 上下滑是捲頁面，這次不管了
        touch.current = null
        return
      }
      t.mode = 'swipe'
      swallowClick.current = true
      event.currentTarget.dataset.dragging = ''
      event.currentTarget.setPointerCapture(t.id)
    }
    const raw = t.base + dx
    // 超出兩端越拉越緊
    const x =
      raw > 0
        ? rubberband(raw, REVEAL)
        : raw < -REVEAL
          ? -REVEAL + rubberband(raw + REVEAL, REVEAL)
          : raw
    paint(x)
    t.samples.push({ t: event.timeStamp, y: x })
    if (t.samples.length > 8) t.samples.shift()
  }

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const t = touch.current
    if (!t || event.pointerId !== t.id) return
    touch.current = null
    window.clearTimeout(hold.current)
    const cancelled = event.type === 'pointercancel'
    if (t.mode === 'sort') {
      if (cancelled) sort?.sorter.cancel()
      else sort?.sorter.end()
      return
    }
    if (t.mode === 'swipe') {
      const target = cancelled
        ? t.base
        : settleReveal({
            offset: offset.current,
            velocity: velocityOf(t.samples, event.timeStamp),
            width: REVEAL,
          })
      if (target !== 0 && t.base === 0) buzz(8)
      settle(target)
      return
    }
    // 露出動作時點一下卡片本身：收回去，這一下不算點到裡面的東西
    if (open && !cancelled) {
      swallowClick.current = true
      settle(0)
    }
  }

  function onDelete() {
    // 第一次按只是進入確認，第二次才真的刪
    if (!confirming) {
      setConfirming(true)
      return
    }
    void remove.run(async () => {
      await deleteItem(item.id)
      buzz([10, 40, 10])
      apply({ table: 'items', eventType: 'DELETE', new: null, old: { id: item.id } })
    })
  }

  function toggle() {
    void run(async () => {
      if (joined) {
        await leaveItem(item.id, me)
        apply({
          table: 'item_members',
          eventType: 'DELETE',
          new: null,
          old: { item_id: item.id, member_name: me },
        })
      } else {
        const row = await joinItem(item.id, me)
        apply({ table: 'item_members', eventType: 'INSERT', new: row, old: null })
      }
      buzz(10)
    })
  }

  return (
    <div
      ref={wrap}
      data-card
      data-sort-id={item.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(event) => {
        if (!swallowClick.current) return
        swallowClick.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
      // 長按拿起卡片時，不要跳出系統的選單
      onContextMenu={(event) => {
        if (touch.current) event.preventDefault()
      }}
      className={`swipe-card ticket relative scroll-mt-44 overflow-hidden rounded-2xl ${
        sort ? 'sortable' : ''
      }`}
    >
      {/* 藏在卡片後面的動作，卡片往左滑才露出來；收著的時候鍵盤和讀螢幕軟體都碰不到。
          往內縮一點並跟著卡片的圓角，才不會從卡片的圓角邊緣透出顏色 */}
      <div data-card-actions inert={!open} aria-hidden={!open} className="absolute inset-y-px right-px flex overflow-hidden rounded-r-[15px]">
        <button
          type="button"
          onClick={() => {
            settle(0)
            onEdit(item)
          }}
          className="flex w-[72px] flex-col items-center justify-center gap-1 bg-ink text-xs font-semibold text-on-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <Pencil size={18} />
          編輯
        </button>
        <button
          type="button"
          disabled={remove.pending}
          onClick={onDelete}
          aria-label={confirming ? `確定刪除 ${item.title}` : `刪除 ${item.title}`}
          className="flex w-[72px] flex-col items-center justify-center gap-1 bg-[#b3261e] text-xs font-semibold text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
        >
          {remove.pending ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <Trash2 size={18} />
          )}
          {remove.pending ? '刪除中…' : confirming ? '確定刪除' : '刪除'}
        </button>
      </div>
      <article
        ref={face}
        data-testid="item-card"
        data-kind={item.kind}
        className="swipe-face relative overflow-hidden rounded-2xl bg-surface"
      >
        <div className="flex items-start gap-1 pb-3 pl-4 pr-1 pt-2.5">
          <div className="min-w-0 flex-1 py-0.5">
            <div className="mb-1 flex items-center gap-1.5">
              {/* 全員是實心標籤，分開是外框標籤：用形狀分，不靠顏色 */}
              <p
                className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ${
                  item.kind === 'all' ? 'bg-ink text-on-ink' : 'border border-ink/40 text-ink'
                }`}
              >
                {item.kind === 'all' ? <Users size={11} /> : <Split size={11} />}
                {item.kind === 'all' ? '全員' : '分開'}
              </p>
              {live && (
                <p
                  data-testid="live-badge"
                  className="inline-flex h-5 items-center rounded-full bg-signal px-2 text-[11px] font-semibold text-white"
                >
                  {live === 'now' ? '進行中' : '下一站'}
                </p>
              )}
              {sort && (
                <span
                  data-grip
                  aria-hidden="true"
                  className="grip -my-2 ml-auto flex h-9 w-9 items-center justify-center text-zinc-400"
                >
                  <GripVertical size={16} />
                </span>
              )}
            </div>
            <h3 className="flex items-start gap-2 text-[17px] font-semibold leading-snug tracking-tight">
              <span className="min-w-0 break-words">{item.title}</span>
              {pinNo !== undefined && (
                <span
                  aria-label={`地圖上的 ${pinNo} 號`}
                  className="mt-[2px] flex h-5 shrink-0 items-center justify-center gap-0.5 rounded-full bg-signal pl-1 pr-1.5 font-mono text-xs font-semibold text-white"
                >
                  <MapPin size={11} />
                  {pinNo}
                </span>
              )}
            </h3>
            {item.place && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-zinc-600">
                <MapPin size={14} className="mt-[3px] shrink-0 text-zinc-400" />
                <span className="min-w-0 break-words">{item.place}</span>
              </p>
            )}
            {item.arrive_place && (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-zinc-600">
                <PlaneLanding size={14} className="mt-[3px] shrink-0 text-zinc-400" />
                <span className="min-w-0 break-words">抵達：{item.arrive_place}</span>
              </p>
            )}
            {item.note && (
              <RichText text={item.note} className="mt-1.5 text-sm leading-relaxed text-zinc-500" />
            )}
          </div>
          <button
            type="button"
            aria-label={`編輯 ${item.title}`}
            onClick={() => onEdit(item)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors active:bg-zinc-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <Pencil size={16} />
          </button>
        </div>

        {from && leg && (
          <DriveNote fromTitle={from.title} from={leg.from} to={leg.to} className="px-4 pb-3" />
        )}

        {hasSpot(item) && (
          <div
            data-testid="card-stub"
            className="ticket-stub relative grid grid-cols-2 divide-x divide-dashed divide-ink/20 border-t border-dashed border-ink/25"
          >
            <a
              href={googlePlaceUrl(item)}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              <MapPin size={16} />
              地圖
            </a>
            <a
              href={googleTransitUrl(from, item)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`怎麼去：${from ? `從「${from.title}」出發` : '從目前位置出發'}`}
              className={linkClass}
            >
              <Navigation size={16} />
              怎麼去
            </a>
          </div>
        )}

        {item.kind === 'split' && (
          <div className="flex items-center justify-between gap-3 border-t border-ink/10 bg-paper/60 py-2 pl-4 pr-3">
            <div className="flex flex-wrap gap-1.5 text-sm">
              {members.length === 0 ? (
                <span className="text-zinc-500">還沒有人加入</span>
              ) : (
                members.map((name) => (
                  <span
                    key={name}
                    className={`rounded-full px-2 py-0.5 ${
                      name === me
                        ? 'bg-signal font-semibold text-white'
                        : 'border border-zinc-300 bg-surface text-zinc-700'
                    }`}
                  >
                    {name}
                  </span>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={toggle}
              className={`${ghostClass} h-10 shrink-0 ${joined ? '' : 'border-ink bg-ink font-semibold text-on-ink active:bg-ink-soft'}`}
            >
              {pending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : joined ? (
                <UserMinus size={16} />
              ) : (
                <UserPlus size={16} />
              )}
              {pending ? '處理中…' : joined ? '退出' : '加入'}
            </button>
          </div>
        )}

        {(error || remove.error) && (
          <p role="alert" className="px-4 pb-3 pt-2 text-sm text-red-700">
            {error || remove.error}
          </p>
        )}
      </article>
    </div>
  )
}
