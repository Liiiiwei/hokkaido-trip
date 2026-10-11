import { DATA_REPO } from './config'
import type { TripData } from './types'
import { parseTripData } from './validate'

// 上次成功讀到的行程存一份在手機裡：沒訊號時照樣能看，開啟時也不用等網路
const KEY = `hokkaido-trip:snapshot:${DATA_REPO.path}`

type Box = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function device(): Box | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function saveSnapshot(data: TripData, box: Box | null = device()): void {
  try {
    box?.setItem(KEY, JSON.stringify(data))
  } catch {
    // 空間滿了或無痕模式存不了：只是少了離線備份
  }
}

// 存的內容壞了就當作沒有，不讓壞掉的備份擋住正常載入
export function loadSnapshot(box: Box | null = device()): TripData | null {
  try {
    const raw = box?.getItem(KEY)
    return raw ? parseTripData(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function clearSnapshot(box: Box | null = device()): void {
  try {
    box?.removeItem(KEY)
  } catch {
    // 清不掉就留著
  }
}
