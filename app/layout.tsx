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
  // 加到 iPhone 主畫面後全螢幕開啟，上方狀態列用系統預設的樣子
  appleWebApp: { capable: true, title: '北海道行程', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // 鍵盤跳出來時畫面跟著縮，底部的按鈕與面板才不會被蓋住
  interactiveWidget: 'resizes-content',
  // 系統的時間、日期選單跟著淺色或深色
  colorScheme: 'light dark',
  // 手機瀏覽器的網址列跟著頂部列的顏色
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#141d2e' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={mono.variable}>
      <body>{children}</body>
    </html>
  )
}
