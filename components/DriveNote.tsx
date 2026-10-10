'use client'

import { Car } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cachedDrive, driveKey, formatDrive, type Drive, type LatLng } from '@/lib/route'

// 兩點之間的開車時間估計。查不到就不顯示，不擋其他內容
export function DriveNote({
  fromTitle,
  from,
  to,
  className,
}: {
  fromTitle: string
  from: LatLng
  to: LatLng
  className?: string
}) {
  const key = driveKey(from, to)
  const [result, setResult] = useState<{ key: string; drive: Drive | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    const [a, b] = key.split('>').map((part) => {
      const [lat, lng] = part.split(',').map(Number)
      return { lat, lng }
    })
    cachedDrive(a, b)
      .then((drive) => {
        if (!cancelled) setResult({ key, drive })
      })
      .catch(() => {
        if (!cancelled) setResult({ key, drive: null })
      })
    return () => {
      cancelled = true
    }
  }, [key])

  // 換了一段路、結果還沒回來時，當成載入中
  const current = result?.key === key ? result : null
  if (current && !current.drive) return null
  return (
    <p className={`flex items-start gap-1.5 text-xs text-zinc-500 ${className ?? ''}`}>
      <Car size={14} className="mt-px shrink-0 text-zinc-400" />
      <span className="min-w-0 break-words">
        {current?.drive ? `從「${fromTitle}」${formatDrive(current.drive)}` : '估算車程中…'}
      </span>
    </p>
  )
}
