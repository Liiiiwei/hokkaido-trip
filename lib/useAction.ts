'use client'

import { useCallback, useState } from 'react'
import { messageOf } from './errors'
import { singleFlight } from './singleFlight'

// 包住一個寫入動作：進行中時 pending 為 true，失敗時 error 有訊息
export function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // pending 要等畫面更新後按鈕才會停用，連點太快會漏；這個立刻生效
  const [guard] = useState(singleFlight)

  const run = useCallback(
    (fn: () => Promise<void>) =>
      guard(async () => {
        setPending(true)
        setError(null)
        try {
          await fn()
        } catch (e) {
          setError(messageOf(e))
        } finally {
          setPending(false)
        }
      }),
    [guard],
  )

  return { pending, error, run }
}
