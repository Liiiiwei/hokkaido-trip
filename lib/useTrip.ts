'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { POLL_MS } from './config'
import { StoreError } from './github'
import { clearSnapshot, loadSnapshot, saveSnapshot } from './offline'
import { applyChange, type Change } from './state'
import { fetchAll, reorderItems } from './store'
import type { TripData } from './types'

export type TripState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'bad_key' }
  | { status: 'bad_data' }
  | { status: 'ready'; data: TripData }

// 只改幾筆行程的順序欄位；只動資料裡還在的行程
function withOrder(data: TripData, orders: Record<string, number | undefined> | null): TripData {
  if (!orders) return data
  return {
    ...data,
    items: data.items.map((i) => (i.id in orders ? { ...i, order: orders[i.id] } : i)),
  }
}

export function useTrip() {
  const [state, setState] = useState<TripState>({ status: 'loading' })
  const [connected, setConnected] = useState(true)
  // 拖曳調順序、還在等存檔的這段時間：哪幾筆行程要先照新順序顯示
  const pendingOrder = useRef<Record<string, number | undefined> | null>(null)

  // 抓全部資料；已經有畫面時抓失敗就保留原畫面，只標示連線中斷
  const reload = useCallback(async () => {
    try {
      const data = await fetchAll()
      // 這次重抓可能是在順序存進去之前就排隊的，拿到的還是舊順序，先套上新的才不會跳回去
      setState({ status: 'ready', data: withOrder(data, pendingOrder.current) })
      setConnected(true)
      saveSnapshot(data)
    } catch (e) {
      if (e instanceof StoreError && e.code === 'bad_key') {
        // 連結失效後不該再看得到行程，手機裡的備份一起清掉
        clearSnapshot()
        setState({ status: 'bad_key' })
        return
      }
      // 資料檔壞了不是等一下就會好的事，就算手機裡有上次的行程也要說出來，主揪才知道要還原
      if (e instanceof StoreError && e.code === 'bad_data') {
        setState({ status: 'bad_data' })
        return
      }
      setConnected(false)
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }))
    }
  }, [])

  // 自己寫入成功後，先把那一筆套進畫面，不用等下一次重抓
  const apply = useCallback((change: Change) => {
    setState((s) =>
      s.status === 'ready' ? { status: 'ready', data: applyChange(s.data, change) } : s,
    )
  }, [])

  // 拖曳調順序：先照新順序顯示，再存；存不成就還原成 before 記的原本順序，並把錯誤丟給呼叫的人
  const reorder = useCallback(
    async (ids: string[], before: Record<string, number | undefined>) => {
      const show = (orders: Record<string, number | undefined>) =>
        setState((s) =>
          s.status === 'ready' ? { status: 'ready', data: withOrder(s.data, orders) } : s,
        )
      pendingOrder.current = Object.fromEntries(ids.map((id, order) => [id, order]))
      show(pendingOrder.current)
      try {
        const data = await reorderItems(ids)
        pendingOrder.current = null
        setState((s) => (s.status === 'ready' ? { status: 'ready', data } : s))
        saveSnapshot(data)
      } catch (e) {
        pendingOrder.current = null
        show(before)
        throw e
      }
    },
    [],
  )

  useEffect(() => {
    // 手機裡有上次的行程就先顯示，再去抓最新的；沒訊號時至少看得到上次的內容
    const saved = loadSnapshot()
    // 只能在瀏覽器讀裝置資料，所以放在 effect 裡
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setState((s) => (s.status === 'loading' ? { status: 'ready', data: saved } : s))
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

  return { state, connected, apply, retry, reload, reorder }
}
