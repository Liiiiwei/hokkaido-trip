'use client'

import { LoaderCircle, MapPinCheck, MapPinOff, Search } from 'lucide-react'
import { useState } from 'react'
import { messageOf } from '@/lib/errors'
import { searchPlaces, type PlaceResult } from '@/lib/geocode'
import { ghostClass } from './ui'

// 定位：座標加上給人看的說明
export type Picked = { lat: number; lng: number; label: string }

// 用地點文字搜尋並選一個結果當定位。
// 使用的地方要帶 key={query}：文字一改，上一次的搜尋結果就清掉
export function PlacePicker({
  query,
  pin,
  onPin,
  disabled,
}: {
  query: string
  pin: Picked | null
  onPin: (pin: Picked | null) => void
  disabled: boolean
}) {
  const [found, setFound] = useState<PlaceResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  async function onSearch() {
    if (searching) return
    setSearching(true)
    setError('')
    setFound(null)
    try {
      setFound(await searchPlaces(query))
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setSearching(false)
    }
  }

  if (pin) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-start gap-1.5 text-sm text-zinc-700">
          <MapPinCheck size={16} className="mt-0.5 shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="font-semibold text-accent">已定位</span>
            {pin.label && <span className="ml-1 break-words text-zinc-500">{pin.label}</span>}
          </span>
        </p>
        <button
          type="button"
          className={`${ghostClass} shrink-0`}
          disabled={disabled}
          onClick={() => onPin(null)}
        >
          <MapPinOff size={16} />
          取消定位
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={`${ghostClass} w-full`}
        disabled={disabled || searching || !query.trim()}
        onClick={onSearch}
      >
        {searching ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}
        {searching ? '搜尋中…' : '找地點'}
      </button>
      {!found && !error && (
        <p className="text-xs text-zinc-500">定位後會出現在地圖上；不定位也能儲存。</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {found && found.length === 0 && (
        <p className="text-sm text-zinc-600">找不到這個地點，換成日文或英文名稱再找一次。</p>
      )}
      {found && found.length > 0 && (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-300">
          {found.map((r) => (
            <li key={`${r.lat},${r.lng},${r.address}`}>
              <button
                type="button"
                className="block min-h-11 w-full px-3 py-2 text-left transition-colors active:bg-zinc-100"
                onClick={() => onPin({ lat: r.lat, lng: r.lng, label: r.address })}
              >
                <span className="block text-sm font-semibold">{r.name}</span>
                <span className="block break-words text-xs text-zinc-500">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
