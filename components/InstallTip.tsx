'use client'

import { Check, Copy, Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadKey, read, shareLink, write } from '@/lib/identity'
import { ghostClass } from './ui'

const DISMISS_KEY = 'hokkaido-trip:installTip'

// Android 的瀏覽器準備好可以安裝時會發這個事件，留著等使用者按「安裝」
type InstallEvent = Event & { prompt: () => Promise<unknown> }

// 這個事件在頁面剛載入時就可能發出，比這個提示出現在畫面上還早，所以程式一載入就先接住
let ready: InstallEvent | null = null
const READY_EVENT = 'trip:installable'
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    ready = event as InstallEvent
    window.dispatchEvent(new Event(READY_EVENT))
  })
}

function standalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

// 提醒可以把網站加到手機主畫面。只在手機瀏覽器裡出現，裝好之後或按過「不用了」就不再出現
export function InstallTip() {
  const [show, setShow] = useState(false)
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  useEffect(() => {
    const dismissed = read(DISMISS_KEY) === '1'
    // 只能在瀏覽器判斷是不是手機、是不是已經裝好，所以放在 effect 裡
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(!dismissed && !standalone() && window.matchMedia('(pointer: coarse)').matches)
    const onReady = () => setInstall(ready)
    const onInstalled = () => setShow(false)
    onReady()
    window.addEventListener(READY_EVENT, onReady)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener(READY_EVENT, onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!show) return null

  function dismiss() {
    // 記不住（無痕模式）就算了，下次會再出現一次
    write(DISMISS_KEY, '1')
    setShow(false)
  }

  async function copy() {
    const key = loadKey()
    try {
      if (!key) throw new Error('no key')
      await navigator.clipboard.writeText(shareLink(window.location.href, key))
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  return (
    <aside
      data-testid="install-tip"
      className="mt-6 rounded-2xl border border-dashed border-ink/25 p-4 text-sm text-zinc-700"
    >
      <p className="font-semibold text-ink">加到主畫面，像 App 一樣打開</p>
      {install ? (
        <p className="mt-1 text-zinc-600">沒有網址列，沒訊號時也看得到上次的行程。</p>
      ) : (
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-zinc-600">
          <li>先按下面的「複製通行連結」</li>
          <li>按瀏覽器的分享鈕或選單，選「加入主畫面」</li>
          <li>從主畫面打開，把連結貼上去</li>
        </ol>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {install ? (
          <button
            type="button"
            className={ghostClass}
            onClick={() => {
              void install.prompt()
              // 這個事件只能用一次
              ready = null
              setInstall(null)
            }}
          >
            <Download size={16} />
            安裝
          </button>
        ) : (
          <button type="button" className={ghostClass} onClick={() => void copy()}>
            {copied === 'done' ? <Check size={16} /> : <Copy size={16} />}
            {copied === 'done' ? '已複製' : '複製通行連結'}
          </button>
        )}
        <button type="button" className={ghostClass} onClick={dismiss}>
          <X size={16} />
          不用了
        </button>
      </div>
      {copied === 'failed' && (
        <p role="alert" className="mt-2 text-red-700">
          複製不了。請回群組複製主揪貼的那個連結。
        </p>
      )}
    </aside>
  )
}
