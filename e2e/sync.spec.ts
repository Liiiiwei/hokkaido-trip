import { expect, test, type Page } from '@playwright/test'
import { DATA_REPO } from '../lib/config'
import { encodeContent } from '../lib/github'

const token = process.env.TRIP_TOKEN!

// 每次跑用不同的名字與標題
const stamp = Date.now().toString().slice(-6)
const nameA = `測A${stamp}`
const nameB = `測B${stamp}`
const title = `同步測試${stamp}`

// 別人的修改最慢一個輪詢週期（15 秒）加上讀寫時間後出現
const SYNC = { timeout: 25_000 }

// 正式資料檔最後一筆修改紀錄；驗收前後應該一樣，代表測試沒有動到大家的行程
async function productionSha(): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}/commits?path=trip.json&per_page=1`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )
  return ((await res.json()) as { sha: string }[])[0].sha
}

let shaBefore = ''

// 把驗收用的資料檔重設成乾淨的初始內容（不存在就建立）
async function resetTestFile() {
  expect(DATA_REPO.path).not.toBe('trip.json')
  const url = `https://api.github.com/repos/${DATA_REPO.owner}/${DATA_REPO.repo}/contents/${DATA_REPO.path}`
  const headers = { Authorization: `Bearer ${token}` }
  const existing = await fetch(url, { headers, cache: 'no-store' })
  const sha = existing.ok ? ((await existing.json()) as { sha: string }).sha : undefined
  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: '重設驗收用資料檔',
      content: encodeContent({
        trip: { title: '驗收用旅程', start_date: '2030-05-01', end_date: '2030-05-03' },
        days: [],
        items: [],
        itemMembers: [],
      }),
      ...(sha ? { sha } : {}),
    }),
  })
  expect(res.ok).toBe(true)
}

test.beforeAll(async () => {
  shaBefore = await productionSha()
  await resetTestFile()
})

async function enter(page: Page, name: string) {
  await page.goto(`/#k=${token}`)
  await page.getByPlaceholder('你的名字或暱稱').fill(name)
  await page.getByRole('button', { name: '進入行程' }).click()
  await expect(page.getByRole('button', { name: '新增行程', exact: true })).toBeVisible()
}

test.afterAll(async () => {
  expect(await productionSha()).toBe(shaBefore)
})

test('兩個人的畫面會同步', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await enter(a, nameA)
  await enter(b, nameB)

  // 權杖不留在網址列
  expect(a.url()).not.toContain(token)

  // A 新增分開行程，B 看得到
  await a.getByRole('button', { name: '新增行程', exact: true }).click()
  await a.getByLabel('分開行動').check()
  await a.getByLabel('標題').fill(title)
  await a.getByRole('button', { name: '儲存' }).click()
  await expect(b.getByText(title)).toBeVisible(SYNC)

  // 兩人同時加入，兩個名字都在
  const cardA = a.getByTestId('item-card').filter({ hasText: title })
  const cardB = b.getByTestId('item-card').filter({ hasText: title })
  await Promise.all([
    cardA.getByRole('button', { name: '加入', exact: true }).click(),
    cardB.getByRole('button', { name: '加入', exact: true }).click(),
  ])
  for (const card of [cardA, cardB]) {
    await expect(card.getByText(nameA)).toBeVisible(SYNC)
    await expect(card.getByText(nameB)).toBeVisible(SYNC)
  }

  // A 刪除，B 的畫面跟著消失
  await cardA.getByRole('button', { name: `編輯 ${title}` }).click()
  await a.getByRole('button', { name: '刪除', exact: true }).click()
  await a.getByRole('button', { name: '確定刪除' }).click()
  await expect(b.getByText(title)).toHaveCount(0, SYNC)
})

test('沒有鑰匙時顯示說明', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/')
  await expect(page.getByText('請用群組裡的完整連結開啟')).toBeVisible()
})
