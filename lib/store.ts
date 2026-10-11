import { setTrip } from './changes'
import { StoreError } from './errors'
import { commit, readFile, writeFile, type Io, type Snapshot } from './github'
import { applyChange, mergePatch } from './state'
import type { Day, Item, ItemInput, ItemMember, Trip, TripData } from './types'
import { STALE_EVENT, versionStatus } from './version'

let key = ''
// 上次讀到的結果；下次讀的時候帶著它的 etag 去問，沒變就不佔額度
let last: Snapshot | undefined

export function setKey(value: string): void {
  key = value
  last = undefined
}

const io: Io = {
  read: async () => (last = await readFile(key, undefined, last)),
  write: (data, sha, message) => writeFile(key, data, sha, message),
}

// 同一台裝置的讀寫排隊依序執行：不會自己撞自己，
// 也不會讓寫入前抓的舊資料在寫入後才蓋回畫面
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job)
  queue = run.catch(() => undefined)
  return run
}

function mutate(change: (data: TripData) => TripData, message: string): Promise<TripData> {
  return enqueue(async () => {
    // 舊版程式存檔會把新版才有的欄位洗掉，所以線上有新版時先不存
    if ((await versionStatus()).action === 'reload') {
      window.dispatchEvent(new Event(STALE_EVENT))
      throw new StoreError('stale')
    }
    return commit(io, change, message)
  })
}

export function fetchAll(): Promise<TripData> {
  return enqueue(async () => (await io.read()).data)
}

export async function updateTrip(trip: Trip): Promise<Trip> {
  await mutate(setTrip(trip), '更新旅程名稱或日期')
  return trip
}

export async function upsertDay(day: Day): Promise<Day> {
  await mutate(
    (d) => applyChange(d, { table: 'days', eventType: 'UPDATE', new: day, old: null }),
    `更新 ${day.date} 的住宿與備註`,
  )
  return day
}

// id 由表單開啟時產生一次：寫入成功但回應掉了、使用者再按一次時，不會多出一筆
export async function createItem(input: ItemInput, me: string, id: string): Promise<Item> {
  const row: Item = {
    ...input,
    id,
    created_by: me,
    updated_at: new Date().toISOString(),
  }
  await mutate(
    (d) => applyChange(d, { table: 'items', eventType: 'INSERT', new: row, old: null }),
    `新增「${row.title}」`,
  )
  return row
}

// patch 只含改過的欄位，其餘欄位保留遠端最新的值
export async function updateItem(id: string, patch: Partial<ItemInput>): Promise<Item> {
  let row: Item | null = null
  await mutate((d) => {
    const current = d.items.find((i) => i.id === id)
    // 已經被別人刪掉就不要把它變回來
    if (!current) throw new StoreError('gone')
    row = mergePatch(current, patch, new Date().toISOString())
    return applyChange(d, { table: 'items', eventType: 'UPDATE', new: row, old: null })
  }, '更新行程')
  if (!row) throw new StoreError('gone')
  return row
}

export async function deleteItem(id: string): Promise<void> {
  await mutate(
    (d) => applyChange(d, { table: 'items', eventType: 'DELETE', new: null, old: { id } }),
    '刪除行程',
  )
}

// ids 是調整後由前到後的順序；只動這幾筆的順序欄位，其他欄位保留遠端最新的值
export function reorderItems(ids: string[]): Promise<TripData> {
  return mutate(
    (d) => ({
      ...d,
      items: d.items.map((i) => {
        const order = ids.indexOf(i.id)
        return order < 0 || i.order === order ? i : { ...i, order }
      }),
    }),
    '調整行程順序',
  )
}

export async function joinItem(itemId: string, me: string): Promise<ItemMember> {
  const row: ItemMember = { item_id: itemId, member_name: me }
  await mutate((d) => {
    if (!d.items.some((i) => i.id === itemId)) throw new StoreError('gone')
    return applyChange(d, { table: 'item_members', eventType: 'INSERT', new: row, old: null })
  }, `${me} 加入行程`)
  return row
}

export async function leaveItem(itemId: string, me: string): Promise<void> {
  await mutate(
    (d) =>
      applyChange(d, {
        table: 'item_members',
        eventType: 'DELETE',
        new: null,
        old: { item_id: itemId, member_name: me },
      }),
    `${me} 退出行程`,
  )
}

export async function renameMember(oldName: string, newName: string): Promise<void> {
  await mutate((d) => {
    const taken =
      d.itemMembers.some((m) => m.member_name === newName) ||
      d.items.some((i) => i.created_by === newName)
    if (taken) throw new StoreError('name_taken')
    return {
      ...d,
      items: d.items.map((i) => (i.created_by === oldName ? { ...i, created_by: newName } : i)),
      itemMembers: d.itemMembers.map((m) =>
        m.member_name === oldName ? { ...m, member_name: newName } : m,
      ),
    }
  }, `${oldName} 改名為 ${newName}`)
}
