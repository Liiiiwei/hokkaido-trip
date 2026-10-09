'use client'

import { useEffect } from 'react'
import { STALE_EVENT, reloadToLatest, versionStatus } from './version'

// 剛打開面板的這段時間內還沒打什麼字，直接換版不會弄丟內容
const GRACE_MS = 1500
const CHECK_MS = 60_000

// 定時、回到前景、開關面板時檢查有沒有新版，有就自動重新整理。
// 面板開著而且可能已經打到一半時不動，等面板關掉再換
export function useVersionWatch(sheetOpen: boolean): void {
  useEffect(() => {
    let stopped = false
    const openedAt = Date.now()
    const check = async () => {
      const { action, latest } = await versionStatus()
      if (stopped || action !== 'reload' || latest === null) return
      if (sheetOpen && Date.now() - openedAt > GRACE_MS) return
      reloadToLatest(latest)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    const onStale = () => void check()
    void check()
    const timer = setInterval(() => void check(), CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(STALE_EVENT, onStale)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(STALE_EVENT, onStale)
    }
  }, [sheetOpen])
}
