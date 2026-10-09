'use client'

import { useCallback, useEffect, useState } from 'react'
import { POLL_MS } from './config'
import { StoreError } from './github'
import { applyChange, type Change } from './state'
import { fetchAll } from './store'
import type { TripData } from './types'

export type TripState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'bad_key' }
  | { status: 'bad_data' }
  | { status: 'ready'; data: TripData }

export function useTrip() {
  const [state, setState] = useState<TripState>({ status: 'loading' })
  const [connected, setConnected] = useState(true)

  // 抓全部資料；已經有畫面時抓失敗就保留原畫面，只標示連線中斷
  const reload = useCallback(async () => {
    try {
      const data = await fetchAll()
      setState({ status: 'ready', data })
      setConnected(true)
    } catch (e) {
      if (e instanceof StoreError && e.code === 'bad_key') {
        setState({ status: 'bad_key' })
        return
      }
      const broken = e instanceof StoreError && e.code === 'bad_data'
      setConnected(false)
      setState((s) => (s.status === 'ready' ? s : { status: broken ? 'bad_data' : 'error' }))
    }
  }, [])

  // 自己寫入成功後，先把那一筆套進畫面，不用等下一次重抓
  const apply = useCallback((change: Change) => {
    setState((s) =>
      s.status === 'ready' ? { status: 'ready', data: applyChange(s.data, change) } : s,
    )
  }, [])

  useEffect(() => {
    // 初次載入：reload 是抓遠端資料，setState 發生在回應回來之後，不是同步更新
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
    // 只在頁面看得見時重抓，省流量也省 API 次數
    const refresh = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    const timer = window.setInterval(refresh, POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [reload])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    void reload()
  }, [reload])

  return { state, connected, apply, retry, reload }
}
