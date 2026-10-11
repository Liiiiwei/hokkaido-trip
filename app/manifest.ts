import type { MetadataRoute } from 'next'

// 網站是整包靜態檔，這個檔案也在建置時就產生好
export const dynamic = 'force-static'

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

// 加到手機主畫面時用的名稱、圖示與開啟方式
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '北海道行程',
    short_name: '北海道行程',
    description: '一起看、一起排的行程表',
    lang: 'zh-Hant',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#ffffff',
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      {
        src: `${base}/icons/maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
