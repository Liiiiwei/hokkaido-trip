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

// 地點搜尋與地圖圖磚也用假的回應，不打外部服務
async function mockMaps(page: Page, results: unknown[]) {
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify(results),
    }),
  )
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
}

async function enter(page: Page) {
  await page.goto('/#k=fake_key')
  await page.getByPlaceholder('你的名字或暱稱').fill('測試')
  await page.getByRole('button', { name: '進入行程' }).click()
  await page.getByRole('button', { name: '新增行程', exact: true }).click()
}

test('找地點定位後，卡片有地圖與怎麼去，當天地圖出現圖釘', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [
    { name: '小樽運河', display_name: '小樽運河, 小樽市, 北海道, 日本', lat: '43.199', lon: '141.001' },
  ])
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('標題').fill('運河散步')
  await dialog.getByLabel('地點').fill('小樽運河')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /小樽市/ }).click()
  await expect(dialog.getByText('已定位')).toBeVisible()
  await dialog.getByRole('button', { name: '儲存' }).click()

  const card = page.getByTestId('item-card').filter({ hasText: '運河散步' })
  const place = await card.getByRole('link', { name: '地圖', exact: true }).getAttribute('href')
  expect(place).toContain('https://www.google.com/maps/search/')
  const route = await card.getByRole('link', { name: '怎麼去' }).getAttribute('href')
  expect(new URL(route!).searchParams.get('travelmode')).toBe('transit')
  expect(new URL(route!).searchParams.get('destination')).toBe('43.199,141.001')
  expect(new URL(route!).searchParams.get('origin')).toBeNull()

  await page.getByRole('button', { name: /當天地圖/ }).click()
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(1)
  await expect(page.locator('.leaflet-marker-icon')).toHaveText('1')
})

test('找不到地點時有提示，不定位也能儲存', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [])
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('標題').fill('神祕小店')
  await dialog.getByLabel('地點').fill('巷子裡的店')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await expect(dialog.getByText('找不到這個地點')).toBeVisible()
  await dialog.getByRole('button', { name: '儲存' }).click()

  const card = page.getByTestId('item-card').filter({ hasText: '神祕小店' })
  await expect(card.getByRole('link', { name: '怎麼去' })).toBeVisible()
  await expect(page.getByRole('button', { name: /當天地圖/ })).toHaveCount(0)
})

test('航班填了抵達機場，下一站的怎麼去從抵達機場出發', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [])
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('開始時間').fill('10:00')
  await dialog.getByLabel('標題').fill('飛札幌')
  await dialog.getByLabel('地點', { exact: true }).fill('羽田機場')
  await dialog.getByLabel('抵達機場／車站').fill('新千歲機場')
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByTestId('item-card').filter({ hasText: '飛札幌' })).toContainText('新千歲機場')

  await page.getByRole('button', { name: '新增行程', exact: true }).click()
  await dialog.getByLabel('開始時間').fill('13:00')
  await dialog.getByLabel('標題').fill('飯店放行李')
  await dialog.getByLabel('地點', { exact: true }).fill('札幌站')
  await dialog.getByRole('button', { name: '儲存' }).click()

  const card = page.getByTestId('item-card').filter({ hasText: '飯店放行李' })
  const route = await card.getByRole('link', { name: /怎麼去/ }).getAttribute('href')
  expect(new URL(route!).searchParams.get('origin')).toBe('新千歲機場')
})

test('住宿定位後，當天地圖與全程地圖都有住宿圖釘', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [
    { name: '測試飯店', display_name: '測試飯店, 札幌市, 北海道, 日本', lat: '43.055', lon: '141.353' },
  ])
  await page.goto('/#k=fake_key')
  await page.getByPlaceholder('你的名字或暱稱').fill('測試')
  await page.getByRole('button', { name: '進入行程' }).click()

  await page.getByRole('button', { name: /的住宿與備註/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('住宿名稱').fill('測試飯店')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /札幌市/ }).click()
  await expect(dialog.getByText('已定位')).toBeVisible()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(page.getByTestId('stay-card')).toContainText('測試飯店')
  await page.getByRole('button', { name: /當天地圖/ }).click()
  await expect(page.locator('.stay-pin')).toHaveCount(1)
  await page.getByRole('button', { name: /當天地圖/ }).click()

  await page.getByRole('button', { name: '全程地圖' }).click()
  const overview = page.getByRole('dialog', { name: '全程地圖' })
  await expect(overview.locator('.stay-pin')).toHaveCount(1)
  await expect(overview.getByRole('button', { name: '全部', exact: true })).toBeVisible()
})

test('全程地圖還沒有定位過的地點時顯示說明', async ({ page }) => {
  await mockGitHub(page)
  await page.goto('/#k=fake_key')
  await page.getByPlaceholder('你的名字或暱稱').fill('測試')
  await page.getByRole('button', { name: '進入行程' }).click()
  await page.getByRole('button', { name: '全程地圖' }).click()
  await expect(page.getByRole('dialog', { name: '全程地圖' }).getByText('還沒有定位過的地點')).toBeVisible()
})

// 假裝線上已經發佈了新版
async function publishNewVersion(page: Page) {
  await page.route('**/version.json*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-2' }) }),
  )
}

test('線上有新版時，開面板的當下就自動換成新版', async ({ page }) => {
  await mockGitHub(page)
  await page.goto('/#k=fake_key')
  await page.getByPlaceholder('你的名字或暱稱').fill('測試')
  await page.getByRole('button', { name: '進入行程' }).click()
  await expect(page.getByRole('button', { name: '新增行程', exact: true })).toBeVisible()
  expect(page.url()).not.toContain('v=')

  await publishNewVersion(page)
  await page.getByRole('button', { name: '新增行程', exact: true }).click()
  await expect(page).toHaveURL(/[?&]v=e2e-2/)
  // 換過一次還是對不上就不再重來，網站照常可用
  await expect(page.getByRole('button', { name: '新增行程', exact: true })).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(page.getByRole('button', { name: '新增行程', exact: true })).toBeVisible()
})

test('內容打到一半才出新版：存檔被擋下、內容還在，關掉面板後才換成新版', async ({ page }) => {
  await mockGitHub(page)
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('標題').fill('打到一半')
  // 過了剛開面板的那一小段時間，才算「打到一半」
  await page.waitForTimeout(2000)
  await publishNewVersion(page)
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(dialog.getByRole('alert')).toContainText('網站剛更新')
  await expect(dialog.getByLabel('標題')).toHaveValue('打到一半')
  expect(page.url()).not.toContain('v=')

  await dialog.getByRole('button', { name: '關閉' }).click()
  await expect(page).toHaveURL(/[?&]v=e2e-2/)
})

test('備註裡的網址可以直接點', async ({ page }) => {
  await mockGitHub(page)
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('標題').fill('訂位')
  await dialog.getByLabel('備註').fill('訂位頁 https://www.example.com/book 記得先訂')
  await dialog.getByRole('button', { name: '儲存' }).click()
  const link = page.getByTestId('item-card').filter({ hasText: '訂位' }).getByRole('link', { name: /example\.com/ })
  await expect(link).toHaveAttribute('href', 'https://www.example.com/book')
})
