'use client'

import { ArrowUpRight } from 'lucide-react'
import { splitLinks } from '@/lib/links'

// 備註欄下方的連結預覽：輸入框裡的網址點不了，在這裡先確認有被認出來
export function LinkPreview({ text }: { text: string }) {
  const links = splitLinks(text).filter((part) => part.type === 'link')
  if (links.length === 0) return null
  return (
    <div className="-mt-1 text-xs text-zinc-500">
      <p>偵測到的連結（存檔後卡片上可以直接點）</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {links.map((link, i) => (
          <li key={`${link.href}-${i}`} className="min-w-0">
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-0.5 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-sm font-medium text-accent transition-colors active:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="truncate">{link.label}</span>
              <ArrowUpRight size={14} className="shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
