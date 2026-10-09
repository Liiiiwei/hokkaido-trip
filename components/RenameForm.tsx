'use client'

import { useState } from 'react'
import { normalizeName, saveName } from '@/lib/identity'
import { renameMember } from '@/lib/store'
import { useAction } from '@/lib/useAction'
import { Field, Sheet, inputClass, primaryClass } from './ui'

export function RenameForm({
  me,
  onRenamed,
  onClose,
}: {
  me: string
  onRenamed: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [raw, setRaw] = useState(me)
  const { pending, error, run } = useAction()
  const name = normalizeName(raw)

  return (
    <Sheet title="改名" onClose={onClose} busy={pending}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name) return
          if (name === me) {
            onClose()
            return
          }
          void run(async () => {
            await renameMember(me, name)
            saveName(name)
            await onRenamed(name)
            onClose()
          })
        }}
      >
        <Field label="你的名字或暱稱">
          <input
            className={inputClass}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            maxLength={40}
            autoFocus
          />
        </Field>
        <p className="text-sm text-zinc-600">你已加入的行程會一起換成新名字。</p>
        <button type="submit" className={primaryClass} disabled={!name || pending}>
          {pending ? '儲存中…' : '儲存'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  )
}
