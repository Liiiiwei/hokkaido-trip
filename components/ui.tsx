'use client'

import type { ReactNode } from 'react'

export const inputClass =
  'h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none focus:border-blue-700'

export const primaryClass =
  'h-12 w-full rounded-xl bg-blue-700 px-4 text-base font-semibold text-white disabled:opacity-50'

export const ghostClass =
  'h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm text-zinc-700 disabled:opacity-50'

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
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 px-3 text-sm text-zinc-500 disabled:opacity-50"
          >
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
