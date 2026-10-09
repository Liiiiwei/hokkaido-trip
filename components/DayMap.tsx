'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import type { Pin } from '@/lib/maps'
import { ghostClass } from './ui'

// 當天地圖：圖釘依行程順序編號並連線。地圖套件只在瀏覽器載入
export function DayMap({ pins }: { pins: Pin[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [attempt, setAttempt] = useState(0)
  // 每次畫面更新 pins 都是新陣列，用內容當依據才不會一直重畫
  const key = JSON.stringify(pins)

  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | null = null
    const list = JSON.parse(key) as Pin[]
    import('leaflet')
      .then((mod) => {
        const L = mod.default ?? mod
        if (cancelled || !box.current) return
        map = L.map(box.current, { scrollWheelZoom: false })
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map)
        const points = list.map((p) => [p.lat, p.lng] as [number, number])
        if (points.length > 1) {
          L.polyline(points, { color: '#1d4ed8', weight: 3, opacity: 0.7 }).addTo(map)
        }
        for (const pin of list) {
          // 標題是大家輸入的文字，用 textContent 放進去，不當成 HTML
          const label = document.createElement('span')
          label.textContent = `${pin.n}. ${pin.title}`
          L.marker([pin.lat, pin.lng], {
            icon: L.divIcon({
              className: 'day-pin',
              html: String(pin.n),
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
            title: label.textContent,
          })
            .bindPopup(label)
            .addTo(map)
        }
        if (points.length === 1) map.setView(points[0], 14)
        else map.fitBounds(points, { padding: [28, 28] })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [key, attempt])

  return (
    // isolate：地圖套件內部的層級很高，關在這裡才不會蓋住面板與底部按鈕
    <div className="relative isolate mt-2 h-56 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
      <div ref={box} className="h-full w-full" aria-label="當天地圖" />
      {status === 'loading' && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-zinc-100 text-sm text-zinc-500">
          地圖載入中…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-zinc-100">
          <p role="alert" className="text-sm text-zinc-700">
            地圖載不出來，請確認網路
          </p>
          <button
            type="button"
            className={ghostClass}
            onClick={() => {
              setStatus('loading')
              setAttempt((n) => n + 1)
            }}
          >
            重試
          </button>
        </div>
      )}
    </div>
  )
}
