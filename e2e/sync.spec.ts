import { expect, test, type Page } from '@playwright/test'
import { commit, readFile, writeFile } from '../lib/github'

const token = process.env.TRIP_TOKEN!

// 每次跑用不同的名字與標題，跑完自己清掉
const stamp = Date.now().toString().slice(-6)
const nameA = `測A${stamp}`
const nameB = `測B${stamp}`
const title = `同步測試${stamp}`

// 別人的修改最慢一個輪詢週期（15 秒）加上讀寫時間後出現
const SYNC = { timeout: 25_000 }

async function enter(page: Page, name: string) {
  await page.goto(`/#k=${token}`)
  await page.getByPlaceholder('你的名字或暱稱').fill(name)
  await page.getByRole('button', { name: '進入行程' }).click()
  await expect(page.getByRole('button', { name: '新增行程', exact: true })).toBeVisible()
}

test.afterAll(async () => {
  // 測試中途失敗也把測試行程清掉
  await commit(
    {
      read: () => readFile(token),
      write: (data, sha, message) => writeFile(token, data, sha, message),
    },
    (data) => {
      const ids = data.items.filter((i) => i.title === title).map((i) => i.id)
      return {
        ...data,
        items: data.items.filter((i) => !ids.includes(i.id)),
        itemMembers: data.itemMembers.filter((m) => !ids.includes(m.item_id)),
      }
    },
    '清除驗收測試資料',
  )
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
