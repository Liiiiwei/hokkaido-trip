// 用密語開門：權杖加密後放在網站上的 door.json，輸入對的密語才解得開。
// 這樣網址不用帶權杖，每台裝置輸入一次密語就好。
// 密語有多難猜，權杖就有多安全：加密檔是公開的，短密語擋不住有心人一個一個試

export type Door = {
  v: 1
  iterations: number
  salt: string
  iv: string
  data: string
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const ITERATIONS = 310_000

// 全形數字與英文算成半形、去掉頭尾空白，手機輸入法打出來的才對得上
export function normalizePass(raw: string): string {
  return raw.normalize('NFKC').trim()
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

async function deriveKey(
  pass: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizePass(pass)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function seal(
  token: string,
  pass: string,
  iterations: number = ITERATIONS,
): Promise<Door> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pass, salt, iterations)
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  )
  return {
    v: 1,
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(data)),
  }
}

// 密語不對就回 null
export async function unseal(door: Door, pass: string): Promise<string | null> {
  try {
    const key = await deriveKey(pass, fromBase64(door.salt), door.iterations)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(door.iv) },
      key,
      fromBase64(door.data),
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

export function parseDoor(body: unknown): Door | null {
  if (typeof body !== 'object' || body === null) return null
  const { v, iterations, salt, iv, data } = body as Record<string, unknown>
  if (v !== 1 || typeof iterations !== 'number' || !Number.isInteger(iterations)) return null
  if (iterations < 1 || iterations > 5_000_000) return null
  if (typeof salt !== 'string' || typeof iv !== 'string' || typeof data !== 'string') return null
  return { v, iterations, salt, iv, data }
}

// none：這個網站沒設密語；offline：連不上，晚點再試
export async function fetchDoor(
  fetchFn: typeof fetch = fetch,
  base: string = BASE,
): Promise<Door | 'none' | 'offline'> {
  try {
    const res = await fetchFn(`${base}/door.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 404) return 'none'
    if (!res.ok) return 'offline'
    return parseDoor(await res.json()) ?? 'none'
  } catch {
    return 'offline'
  }
}
