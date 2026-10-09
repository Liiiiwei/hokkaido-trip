'use client'

import type { Change } from '@/lib/state'
import { joinItem, leaveItem } from '@/lib/store'
import type { Item } from '@/lib/types'
import { useAction } from '@/lib/useAction'
import { ghostClass } from './ui'

export function ItemCard({
  item,
  members,
  me,
  onEdit,
  apply,
}: {
  item: Item
  members: string[]
  me: string
  onEdit: (item: Item) => void
  apply: (change: Change) => void
}) {
  const { pending, error, run } = useAction()
  const joined = members.includes(me)
  const time = item.start_time
    ? item.end_time
      ? `${item.start_time}–${item.end_time}`
      : item.start_time
    : '時間未定'

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
    <article data-testid="item-card" className="rounded-xl border border-zinc-200 bg-white">
      <button
        type="button"
        aria-label={`編輯 ${item.title}`}
        onClick={() => onEdit(item)}
        className="block w-full p-3 text-left"
      >
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="tabular-nums">{time}</span>
          {item.kind === 'all' && (
            <span className="rounded border border-zinc-300 px-1.5">全員</span>
          )}
        </div>
        <div className="mt-1 text-base font-semibold">{item.title}</div>
        {item.place && <div className="mt-0.5 text-sm text-zinc-600">{item.place}</div>}
        {item.note && (
          <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-500">{item.note}</div>
        )}
      </button>

      {item.kind === 'split' && (
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 p-3">
          <div className="flex flex-wrap gap-1.5 text-sm">
            {members.length === 0 ? (
              <span className="text-zinc-400">還沒有人加入</span>
            ) : (
              members.map((name) => (
                <span
                  key={name}
                  className={`rounded-full px-2 py-0.5 ${
                    name === me ? 'bg-blue-700 text-white' : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {name}
                </span>
              ))
            )}
          </div>
          <button type="button" disabled={pending} onClick={toggle} className={`${ghostClass} shrink-0`}>
            {pending ? '處理中…' : joined ? '退出' : '加入'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="px-3 pb-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </article>
  )
}
