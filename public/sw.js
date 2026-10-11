// 讓網站沒有網路也打得開：把頁面本身與程式檔存一份在手機裡。
// 行程資料不經過這裡（那是 GitHub 的網址，頁面自己另外存一份上次讀到的內容）。

const CACHE = 'trip-shell'
// 記在快取裡的假網址，用來知道存的是哪一版的程式檔
const BUILD_MARK = '__build'
// 訊號很差時不要一直等：頁面超過這麼久沒回來就先用存的那一份
const PAGE_TIMEOUT_MS = 3000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const scope = () => new URL(self.registration.scope)

async function put(request, response) {
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
  return response
}

// 頁面：有網路就拿最新的（新版才換得上去），拿不到或太慢才用存的。
// 兩個例外，都是為了不讓新舊版混在一起：
// 一、網址帶 v 的是「發現新版，重新整理」，一定要等到新的頁面，等不到才用存的；
//     太慢就給舊頁面的話，網站會以為換版失敗而放棄，舊程式存檔會洗掉新版才有的欄位。
// 二、這次已經先給了存的舊頁面，晚到的新頁面就不存：它要用的新程式檔還沒存，
//     存了之後斷網再開會是新頁面配不到程式檔，整頁空白
async function page(request) {
  const saved = await caches.match(scope().href)
  let gaveSaved = false
  const fresh = fetch(request).then((response) => {
    if (response.ok && !gaveSaved) void put(scope().href, response.clone())
    return response
  })
  if (!saved) return fresh
  const fallback = fresh.catch(() => saved)
  if (new URL(request.url).searchParams.has('v')) return fallback
  const slow = new Promise((resolve) =>
    setTimeout(() => {
      gaveSaved = true
      resolve(saved)
    }, PAGE_TIMEOUT_MS),
  )
  return Promise.race([fallback, slow])
}

// 程式檔、樣式、字體：檔名帶版本，內容不會變，存過就直接用
async function asset(request) {
  return (await caches.match(request)) ?? put(request, await fetch(request))
}

// 其他檔案（圖示、主畫面設定檔）檔名不帶版本：有網路就拿新的，沒網路才用存的
async function other(request) {
  try {
    return await put(request, await fetch(request))
  } catch (error) {
    const saved = await caches.match(request)
    if (saved) return saved
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope().pathname)) return
  // 版本代號一定要問線上，不然永遠不知道有新版
  if (url.pathname.endsWith('/version.json')) return
  if (request.mode === 'navigate') event.respondWith(page(request))
  else if (url.pathname.includes('/_next/static/')) event.respondWith(asset(request))
  else event.respondWith(other(request))
})

// 頁面開好後告訴這裡它是哪一版、用了哪些檔案。
// 第一次來的時候檔案是在這支程式啟動前載入的，要靠這份清單補存；換版時順便清掉舊版的檔案
async function remember({ build, urls }) {
  const cache = await caches.open(CACHE)
  const mark = await cache.match(BUILD_MARK)
  if (mark && (await mark.text()) !== build) {
    for (const key of await cache.keys()) await cache.delete(key)
  }
  await cache.put(BUILD_MARK, new Response(build))
  const wanted = [scope().href, ...urls]
  await Promise.all(
    wanted.map(async (url) => {
      if (await cache.match(url)) return
      try {
        await put(url, await fetch(url))
      } catch {
        // 這個檔案這次沒存到，下次用到時會再存
      }
    }),
  )
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'shell') event.waitUntil(remember(event.data))
})
