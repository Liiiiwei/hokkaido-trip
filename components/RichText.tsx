'use client'

import { ArrowUpRight } from 'lucide-react'
import { splitLinks } from '@/lib/links'

// 備註文字：網址變成可以點的連結，顯示成網站名稱
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={`whitespace-pre-wrap break-words ${className ?? ''}`}>
      {splitLinks(text).map((part, i) =>
        part.type === 'text' ? (
          part.value
        ) : (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 rounded font-medium text-accent underline decoration-accent/40 underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {part.label}
            <ArrowUpRight size={14} />
          </a>
        ),
      )}
    </p>
  )
}
