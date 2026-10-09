export type TextPart =
  | { type: 'text'; value: string }
  | { type: 'link'; href: string; label: string }

// 只認 http 與 https；遇到空白、引號、括號或中文標點就算網址結束
const URL_RE = /https?:\/\/[^\s<>"'，。、；：！？（）()「」]+/g

// 把備註切成文字與網址，網址顯示成網站名稱，長網址才不會把版面撐爆
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const href = match[0]
    let label: string
    try {
      label = new URL(href).hostname.replace(/^www\./, '')
    } catch {
      continue
    }
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) })
    parts.push({ type: 'link', href, label })
    last = match.index + href.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
