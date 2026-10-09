'use client'

import { useState } from 'react'
import { normalizeName, saveName } from '@/lib/identity'
import { inputClass, primaryClass } from './ui'

export function NameGate({ onDone }: { onDone: (name: string) => void }) {
  const [raw, setRaw] = useState('')
  const name = normalizeName(raw)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">北海道行程</h1>
      <p className="mt-2 text-sm text-zinc-600">第一次來，先告訴大家你是誰。</p>
      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name) return
          saveName(name)
          onDone(name)
        }}
      >
        <input
          className={inputClass}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="你的名字或暱稱"
          maxLength={40}
          autoFocus
        />
        <button type="submit" className={primaryClass} disabled={!name}>
          進入行程
        </button>
      </form>
    </main>
  )
}
