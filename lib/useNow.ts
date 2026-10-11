'use client'

import { useEffect, useState } from 'react'

// 現在的時間，每隔一陣子與回到前景時更新；用來標出今天的下一站
export function useNow(stepMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const timer = setInterval(tick, stepMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [stepMs])
  return now
}
