import { BUILD_ID } from './version'

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

// 這個頁面載入過、而且屬於本站的檔案（程式、樣式、字體、圖示）
export function shellUrls(entries: { name: string }[], origin: string, base: string): string[] {
  const prefix = `${origin}${base}/`
  const urls = entries
    .map((e) => e.name)
    .filter((url) => url.startsWith(prefix) && !url.includes('/version.json'))
  return [...new Set(urls)]
}

// 啟用離線開啟：只在正式版啟用，開發時程式檔一直在變，存起來反而拿到舊的
export function registerShell(): void {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker
    .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
    .then(() => navigator.serviceWorker.ready)
    .then((registration) => {
      registration.active?.postMessage({
        type: 'shell',
        build: BUILD_ID,
        urls: shellUrls(performance.getEntriesByType('resource'), window.location.origin, BASE),
      })
    })
    .catch(() => {
      // 註冊不了就算了：網站照常使用，只是沒網路時打不開
    })
}
