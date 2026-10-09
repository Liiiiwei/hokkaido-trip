'use client'

import { useCallback, useState } from 'react'
import { messageOf } from './errors'

// 包住一個寫入動作：進行中時 pending 為 true，失敗時 error 有訊息
export function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (fn: () => Promise<void>) => {
    setPending(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setPending(false)
    }
  }, [])

  return { pending, error, run }
}
