import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

// 時間、日期、編號用的等寬字體；中文沿用系統字體
const mono = IBM_Plex_Mono({
  weight: ['500', '600'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '北海道行程',
  description: '一起看、一起排的行程表',
  // 連結就是通行證，不讓搜尋引擎收錄
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={mono.variable}>
      <body>{children}</body>
    </html>
  )
}
