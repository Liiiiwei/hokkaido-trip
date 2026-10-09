import { expect, test, type Page } from '@playwright/test'

// 這個檔案的測試不碰真的 GitHub：用記憶體裡的假資料檔回應
const seed = {
  trip: { title: '測試旅程', start_date: '2030-05-01', end_date: '2030-05-03' },
  days: [],
  items: [],
  itemMembers: [],
}

async function mockGitHub(page: Page) {
  let text = JSON.stringify(seed)
  let version = 1
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
  }
  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({
          content: Buffer.from(text, 'utf8').toString('base64'),
          sha: String(version),
        }),
      })
    }
    const body = JSON.parse(request.postData() ?? '{}')
    if (body.sha !== String(version)) return route.fulfill({ status: 409, headers: cors, body: '{}' })
    text = Buffer.from(body.content, 'base64').toString('utf8')
    version += 1
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' })
  })
}

test('點面板外面不會關掉，打到一半的內容還在', async ({ page }) => {
  await mockGitHub(page)
  await page.goto('/#k=fake_key')
  await page.getByPlaceholder('你的名字或暱稱').fill('測試')
  await page.getByRole('button', { name: '進入行程' }).click()
  await page.getByRole('button', { name: '新增行程', exact: true }).click()
  await page.getByLabel('標題').fill('打到一半')

  // 面板上方露出來的半透明背景
  await page.mouse.click(195, 10)

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('標題')).toHaveValue('打到一半')
})
