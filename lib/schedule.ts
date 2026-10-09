import type { Item, ItemMember } from './types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const MAX_DAYS = 366
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function toUtc(date: string): number {
  return DATE_RE.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN
}

// 依起訖日產生每天的日期；格式不對或回程早於出發時回傳空陣列
export function listDates(start: string, end: string): string[] {
  const a = toUtc(start)
  const b = toUtc(end)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return []
  const out: string[] = []
  for (let t = a; t <= b && out.length < MAX_DAYS; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

// 依開始時間排；沒填時間排最後；同時間全員在前
export function sortItems(items: Item[]): Item[] {
  const timeKey = (t: string | null) => t ?? '99:99'
  const kindRank = (i: Item) => (i.kind === 'all' ? 0 : 1)
  return [...items].sort(
    (x, y) =>
      timeKey(x.start_time).localeCompare(timeKey(y.start_time)) ||
      kindRank(x) - kindRank(y) ||
      x.title.localeCompare(y.title, 'zh-Hant') ||
      x.id.localeCompare(y.id),
  )
}

export type Block =
  | { type: 'all'; item: Item }
  | { type: 'split'; startTime: string | null; items: Item[] }

// 把當天行程排成時間軸；開始時間相同的分開行程併成一組
export function buildBlocks(items: Item[]): Block[] {
  const blocks: Block[] = []
  for (const item of sortItems(items)) {
    if (item.kind === 'all') {
      blocks.push({ type: 'all', item })
      continue
    }
    const last = blocks[blocks.length - 1]
    if (last && last.type === 'split' && last.startTime === item.start_time) {
      last.items.push(item)
    } else {
      blocks.push({ type: 'split', startTime: item.start_time, items: [item] })
    }
  }
  return blocks
}

export function membersOf(itemId: string, itemMembers: ItemMember[]): string[] {
  return itemMembers.filter((m) => m.item_id === itemId).map((m) => m.member_name)
}

// 「只看我的」：全員行程，加上我已加入的分開行程
export function filterMine(items: Item[], itemMembers: ItemMember[], me: string): Item[] {
  return items.filter((i) => i.kind === 'all' || membersOf(i.id, itemMembers).includes(me))
}

// 改成新的起訖日後，哪些有行程的日子會被排除
export function datesLosingItems(items: Item[], newStart: string, newEnd: string): string[] {
  const lost = items.filter((i) => i.day < newStart || i.day > newEnd).map((i) => i.day)
  return [...new Set(lost)].sort()
}

export function defaultDate(dates: string[], today: string): string {
  return dates.includes(today) ? today : (dates[0] ?? '')
}

export function localToday(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function dayParts(date: string): { md: string; weekday: string } {
  const d = new Date(toUtc(date))
  return { md: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, weekday: WEEKDAYS[d.getUTCDay()] }
}

export function dayLabel(date: string): string {
  const { md, weekday } = dayParts(date)
  return `${md}（${weekday}）`
}
