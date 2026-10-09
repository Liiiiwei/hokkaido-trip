'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'

// 按下去有回饋、用鍵盤操作時看得到焦點
const press =
  'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'

export const inputClass =
  'h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none transition-colors focus:border-blue-700'

export const primaryClass = `inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-base font-semibold text-white active:bg-blue-800 disabled:opacity-50 ${press}`

export const ghostClass = `inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-4 text-sm text-zinc-700 active:bg-zinc-100 disabled:opacity-50 ${press}`

// 從底部滑出的面板。只有「關閉」能收起：手機上很容易誤觸背景，打到一半的內容會不見。
// busy 時不能關，否則存檔失敗的訊息會看不到
export function Sheet({
  title,
  onClose,
  busy = false,
  children,
}: {
  title: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`-mr-2 inline-flex h-11 items-center gap-1 rounded-lg px-3 text-sm text-zinc-600 active:bg-zinc-100 disabled:opacity-50 ${press}`}
          >
            <X size={16} />
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-zinc-600">{label}</span>
      {children}
    </label>
  )
}
