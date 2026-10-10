'use client'

import 'leaflet/dist/leaflet.css'
import { RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { ghostClass } from './ui'

// stop：行程地點，圓形、裡面是編號或日期；stay：住宿，方形、房子圖示
export type MapMarker = {
  lat: number
  lng: number
  kind: 'stop' | 'stay'
  text: string
  title: string
}

export type MapLine = [number, number][]

// 住宿圖釘的房子圖示（固定字串，不含使用者輸入）
const HOUSE =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3 3 10.5V20a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1v-9.5z"/></svg>'

// 地圖：圖釘加連線。地圖套件只在瀏覽器載入
export function MapView({
  markers,
  lines,
  heightClass = 'h-56',
  lockDragOnTouch = false,
}: {
  markers: MapMarker[]
  lines: MapLine[]
  heightClass?: string
  // 嵌在會捲動的頁面裡時設為 true：手機上單指拖地圖會卡住頁面捲動
  lockDragOnTouch?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [attempt, setAttempt] = useState(0)
  // 每次畫面更新傳進來的都是新陣列，用內容當依據才不會一直重畫
  const key = JSON.stringify({ markers, lines })

  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | null = null
    const content = JSON.parse(key) as { markers: MapMarker[]; lines: MapLine[] }
    import('leaflet')
      .then((mod) => {
        const L = mod.default ?? mod
        if (cancelled || !box.current) return
        const touch = window.matchMedia('(pointer: coarse)').matches
        map = L.map(box.current, {
          scrollWheelZoom: false,
          dragging: !(lockDragOnTouch && touch),
        })
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map)
        for (const line of content.lines) {
          if (line.length > 1) {
            L.polyline(line, { color: '#0e1a2b', weight: 3, opacity: 0.6 }).addTo(map)
          }
        }
        for (const m of content.markers) {
          // 標題是大家輸入的文字，用 textContent 放進去，不當成 HTML
          const label = document.createElement('span')
          label.textContent = m.title
          const stay = m.kind === 'stay'
          const face = document.createElement('span')
          if (stay) face.innerHTML = HOUSE
          else face.textContent = m.text
          const width = stay ? 30 : Math.max(28, m.text.length * 9 + 12)
          L.marker([m.lat, m.lng], {
            icon: L.divIcon({
              className: stay ? 'stay-pin' : 'day-pin',
              html: face,
              iconSize: [width, stay ? 30 : 28],
              iconAnchor: [width / 2, stay ? 15 : 14],
            }),
            title: m.title,
            // 住宿墊在下面，行程編號才不會被蓋住
            zIndexOffset: stay ? -500 : 0,
          })
            .bindPopup(label)
            .addTo(map)
        }
        const points = content.markers.map((m) => [m.lat, m.lng] as [number, number])
        const spread = new Set(points.map((p) => p.join(','))).size
        if (spread === 1) map.setView(points[0], 14)
        else if (spread > 1) map.fitBounds(points, { padding: [32, 32] })
        else map.setView([43.06, 141.35], 9)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [key, attempt, lockDragOnTouch])

  return (
    // isolate：地圖套件內部的層級很高，關在這裡才不會蓋住面板與底部按鈕
    <div
      className={`relative isolate overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 ${heightClass}`}
    >
      <div ref={box} className="h-full w-full" aria-label="地圖" />
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
            <RefreshCw size={16} />
            重試
          </button>
        </div>
      )}
    </div>
  )
}

// 圖例：形狀不同，不靠顏色分辨
export function MapLegend({ stopLabel }: { stopLabel: string }) {
  return (
    <p className="mt-1.5 flex items-center gap-4 text-xs text-zinc-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-signal" />
        {stopLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-[3px] border-2 border-signal bg-white" />
        住宿
      </span>
    </p>
  )
}
