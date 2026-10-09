const NAME_KEY = 'hokkaido-trip:name'
const MINE_KEY = 'hokkaido-trip:only-mine'
const KEY_KEY = 'hokkaido-trip:key'
const MAX_NAME = 20

// 去頭尾空白（含全形）、中間空白併成一個、最多 20 個字
export function normalizeName(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').trim()
  return Array.from(clean).slice(0, MAX_NAME).join('').trim()
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 無痕模式或被封鎖時存不了；這次照常使用，下次再問一次名字
  }
}

export function loadName(): string | null {
  const name = normalizeName(read(NAME_KEY) ?? '')
  return name || null
}

export function saveName(name: string): void {
  write(NAME_KEY, name)
}

export function loadOnlyMine(): boolean {
  return read(MINE_KEY) === '1'
}

export function saveOnlyMine(value: boolean): void {
  write(MINE_KEY, value ? '1' : '0')
}

// 分享連結長這樣：網址#k=權杖；後面若被加了別的參數就忽略
export function parseKey(hash: string): string | null {
  const match = /^#k=([A-Za-z0-9_]+)/.exec(hash)
  return match ? match[1] : null
}

export function loadKey(): string | null {
  return read(KEY_KEY) || null
}

export function saveKey(key: string): void {
  write(KEY_KEY, key)
}
