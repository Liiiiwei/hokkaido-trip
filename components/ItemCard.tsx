'use client'

import {
  LoaderCircle,
  MapPin,
  Navigation,
  Pencil,
  PlaneLanding,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { googlePlaceUrl, googleTransitUrl, hasSpot, type StaySpot } from '@/lib/maps'
import type { Change } from '@/lib/state'
import { joinItem, leaveItem } from '@/lib/store'
import type { Item } from '@/lib/types'
import { useAction } from '@/lib/useAction'
import { RichText } from './RichText'
import { ghostClass } from './ui'

const linkClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-800 transition-colors active:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

// 行程卡片。時間顯示在左邊的時間軸上，卡片本身只放內容與動作
export function ItemCard({
  item,
  members,
  me,
  pinNo,
  from,
  onEdit,
  apply,
}: {
  item: Item
  members: string[]
  me: string
  // 在當天地圖上的編號；沒定位就沒有
  pinNo?: number
  // 「怎麼去」的起點：我的上一站，當天第一站則是早上出發的住宿
  from: Item | StaySpot | null
  onEdit: (item: Item) => void
  apply: (change: Change) => void
}) {
  const { pending, error, run } = useAction()
  const joined = members.includes(me)

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
    })
  }

  return (
    <article
      data-testid="item-card"
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
    >
      <div className="flex items-start gap-1 py-2.5 pl-3 pr-1">
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="flex items-center gap-2 text-base font-semibold leading-snug">
            <span className="min-w-0 break-words">{item.title}</span>
            {pinNo !== undefined && (
              <span
                aria-label={`地圖上的 ${pinNo} 號`}
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1 font-mono text-xs font-semibold text-white"
              >
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
          {item.note && <RichText text={item.note} className="mt-1.5 text-sm text-zinc-500" />}
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

      {hasSpot(item) && (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
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
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50 px-3 py-2">
          <div className="flex flex-wrap gap-1.5 text-sm">
            {members.length === 0 ? (
              <span className="text-zinc-500">還沒有人加入</span>
            ) : (
              members.map((name) => (
                <span
                  key={name}
                  className={`rounded-full px-2 py-0.5 ${
                    name === me
                      ? 'bg-accent font-semibold text-white'
                      : 'border border-zinc-300 bg-white text-zinc-700'
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
            className={`${ghostClass} h-10 shrink-0 ${joined ? '' : 'border-zinc-900 font-semibold text-zinc-900'}`}
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

      {error && (
        <p role="alert" className="px-3 pb-3 pt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </article>
  )
}
