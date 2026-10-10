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
  // 車程估計固定回 30 分鐘、12.3 公里
  await page.route('https://router.project-osrm.org/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify({ code: 'Ok', routes: [{ duration: 1800, distance: 12345 }] }),
    }),
  )
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

  // 地圖預設展開，不用點開就看得到圖釘
  await expect(page.getByRole('button', { name: /當天地圖/ })).toHaveAttribute('aria-expanded', 'true')
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
  // 地圖預設展開
  await expect(page.locator('.stay-pin')).toHaveCount(1)
  // 收起來之後圖釘就不在畫面上
  await page.getByRole('button', { name: /當天地圖/ }).click()
  await expect(page.locator('.stay-pin')).toHaveCount(0)

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

test('沒有「只看我的」開關；以前開過的人也看得到全部行程', async ({ page }) => {
  await mockGitHub(page)
  // 以前的版本把開關狀態記在裝置上
  await page.addInitScript(() => {
    localStorage.setItem('hokkaido-trip:only-mine', '1')
  })
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('分開行動').check()
  await dialog.getByLabel('標題').fill('別人的行程')
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(page.getByTestId('item-card').filter({ hasText: '別人的行程' })).toBeVisible()
  await expect(page.getByText('只看我的')).toHaveCount(0)
})

test('編輯面板的備註欄下方會列出偵測到的連結', async ({ page }) => {
  await mockGitHub(page)
  await enter(page)
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('偵測到的連結')).toHaveCount(0)
  await dialog.getByLabel('備註').fill('訂位 https://www.example.com/book 菜單 https://menu.test/a')
  await expect(dialog.getByText('偵測到的連結')).toBeVisible()
  await expect(dialog.getByRole('link', { name: /example\.com/ })).toHaveAttribute('href', 'https://www.example.com/book')
  await expect(dialog.getByRole('link', { name: /menu\.test/ })).toHaveAttribute('href', 'https://menu.test/a')
})

test('從住宿到第一站、以及回住宿，都有開車時間的估計', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [
    { name: '測試地點', display_name: '測試地點, 札幌市, 北海道, 日本', lat: '43.055', lon: '141.353' },
    { name: '另一個地點', display_name: '另一個地點, 小樽市, 北海道, 日本', lat: '43.2', lon: '141.0' },
  ])
  await page.goto('/#k=fake_key')
  await page.getByPlaceholder('你的名字或暱稱').fill('測試')
  await page.getByRole('button', { name: '進入行程' }).click()
  const dialog = page.getByRole('dialog')

  // 5/1 晚上住的地方
  await page.getByRole('button', { name: /的住宿與備註/ }).click()
  await dialog.getByLabel('住宿名稱').fill('測試飯店')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /札幌市/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(dialog).toHaveCount(0)

  // 5/2 的第一站：從前一晚的住宿出發
  await page.getByRole('button', { name: /^5\/2/ }).click()
  await page.getByRole('button', { name: '新增行程', exact: true }).click()
  await dialog.getByLabel('標題').fill('滑雪')
  await dialog.getByLabel('地點', { exact: true }).fill('雪場')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /小樽市/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  const card = page.getByTestId('item-card').filter({ hasText: '滑雪' })
  await expect(card.getByText('從「測試飯店」開車約 30 分 · 12 公里')).toBeVisible()

  // 5/1 的最後一站：回當晚的住宿
  await page.getByRole('button', { name: /^5\/1/ }).click()
  await page.getByRole('button', { name: '新增行程', exact: true }).click()
  await dialog.getByLabel('標題').fill('逛街')
  await dialog.getByLabel('地點', { exact: true }).fill('商店街')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /小樽市/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  const back = page.getByTestId('return-leg')
  await expect(back).toContainText('回住宿')
  await expect(back).toContainText('測試飯店')
  await expect(back).toContainText('從「逛街」開車約 30 分 · 12 公里')
  await expect(back.getByRole('link', { name: /怎麼去/ })).toHaveAttribute('href', /travelmode=transit/)

  // 地點和住宿是同一個點的行程，不顯示車程
  await page.getByRole('button', { name: '新增行程', exact: true }).click()
  await dialog.getByLabel('開始時間').fill('08:00')
  await dialog.getByLabel('標題').fill('飯店門口集合')
  await dialog.getByLabel('地點', { exact: true }).fill('飯店')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /札幌市/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await page.getByRole('button', { name: /^5\/2/ }).click()
  await page.getByRole('button', { name: '新增行程', exact: true }).click()
  await dialog.getByLabel('開始時間').fill('07:00')
  await dialog.getByLabel('標題').fill('大廳集合')
  await dialog.getByLabel('地點', { exact: true }).fill('飯店')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /札幌市/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  const lobby = page
    .getByTestId('item-card')
    .filter({ has: page.getByRole('heading', { name: '大廳集合' }) })
  await expect(lobby).toBeVisible()
  await expect(lobby.getByText(/開車約|估算車程中/)).toHaveCount(0)
})

// 這台電腦的系統設定開了「減少動態」「減少透明度」，測試要明確指定才測得到動畫與半透明
async function fullMotion(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: 'no-preference' },
      { name: 'prefers-reduced-transparency', value: 'no-preference' },
    ],
  })
}

// 從面板標題列往下拖
async function dragSheetDown(page: Page, distance: number) {
  // 等面板滑到定位再量位置，不然量到的是滑到一半的位置
  await expect(page.getByRole('dialog')).toHaveAttribute('style', /translate3d\(0px, 0px, 0px\)/)
  const header = page.getByRole('dialog').locator('[data-sheet-handle]')
  const box = (await header.boundingBox())!
  const x = box.x + 60
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let step = 1; step <= 10; step += 1) await page.mouse.move(x, y + (distance * step) / 10)
  await page.mouse.up()
}

test('全程地圖面板往下拖可以收起；表單面板拖不掉，內容還在', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [])
  await fullMotion(page)
  // enter 結束時新增行程的面板已經開著
  await enter(page)

  await page.getByLabel('標題').fill('打到一半')
  await dragSheetDown(page, 400)
  await page.waitForTimeout(800)
  await expect(page.getByRole('dialog', { name: '新增行程' })).toBeVisible()
  await expect(page.getByLabel('標題')).toHaveValue('打到一半')

  // 按「關閉」會滑下去再消失
  await page.getByRole('button', { name: '關閉' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: '全程地圖' }).click()
  await expect(page.getByRole('dialog', { name: '全程地圖' })).toBeVisible()
  await dragSheetDown(page, 400)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('頂部列與底部按鈕列是半透明的，內容從底下捲過', async ({ page }) => {
  await mockGitHub(page)
  await fullMotion(page)
  await enter(page)
  for (const bar of [page.locator('header'), page.getByTestId('bottom-bar')]) {
    const filter = await bar.evaluate((el) => {
      const style = getComputedStyle(el)
      return style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter')
    })
    expect(filter).toContain('blur')
  }
})

test('配色：雪白底與淺色頂部列、選到的日期與主要按鈕是鈷藍配白字、卡片有票根', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [
    { name: '小樽運河', display_name: '小樽運河, 小樽市, 北海道, 日本', lat: '43.199', lon: '141.001' },
  ])
  await fullMotion(page)
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('標題').fill('運河散步')
  await dialog.getByLabel('地點', { exact: true }).fill('小樽運河')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /小樽市/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(dialog).toHaveCount(0)

  const bg = (el: Element) => getComputedStyle(el).backgroundColor
  const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  const SIGNAL = 'rgb(32, 80, 200)'

  // 整頁底色是雪白，頂部列是淺色配深色字
  expect(await page.locator('body').evaluate(bg)).toBe('rgb(245, 247, 251)')
  for (const value of channels(await page.locator('header').evaluate(bg))) {
    expect(value).toBeGreaterThan(230)
  }
  const title = page.getByRole('button', { name: '編輯旅程' })
  for (const value of channels(await title.evaluate((el) => getComputedStyle(el).color))) {
    expect(value).toBeLessThan(60)
  }

  // 選到的日期、主要按鈕用鈷藍配白字
  const activeDay = page.getByRole('navigation', { name: '日期' }).locator('[aria-pressed="true"]')
  expect(await activeDay.evaluate(bg)).toBe(SIGNAL)
  const add = page.getByRole('button', { name: '新增行程', exact: true })
  expect(await add.evaluate(bg)).toBe(SIGNAL)
  for (const el of [activeDay, add]) {
    for (const value of channels(await el.evaluate((node) => getComputedStyle(node).color))) {
      expect(value).toBeGreaterThan(230)
    }
  }

  // 卡片標出全員或分開，動作列用虛線和上半部隔開，像票根
  const card = page.getByTestId('item-card').filter({ hasText: '運河散步' })
  await expect(card).toHaveAttribute('data-kind', 'all')
  const stub = card.getByTestId('card-stub')
  await expect(stub.getByRole('link', { name: '地圖', exact: true })).toBeVisible()
  expect(await stub.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('dashed')
})

test('旅程天數多到日期列要橫向捲時，選最後一天整頁不會被往旁邊推', async ({ page }) => {
  await mockGitHub(page)
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '關閉' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: '編輯旅程' }).click()
  await dialog.getByLabel('回程日').fill('2030-05-14')
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole('navigation', { name: '日期' }).getByRole('button', { name: /^5\/14/ }).click()
  await page.waitForTimeout(800)
  const size = await page.evaluate(() => ({
    pageWidth: document.scrollingElement!.scrollWidth,
    viewport: document.documentElement.clientWidth,
    scrollX: window.scrollX,
    stayLeft: document.querySelector('[data-testid="stay-card"]')!.getBoundingClientRect().left,
  }))
  expect(size.pageWidth).toBeLessThanOrEqual(size.viewport)
  expect(size.scrollX).toBe(0)
  expect(size.stayLeft).toBeGreaterThanOrEqual(0)
})

test('標題長到換行時，地圖編號對齊第一行', async ({ page }) => {
  await mockGitHub(page)
  await mockMaps(page, [
    { name: '民宿', display_name: '民宿, 札幌市, 北海道, 日本', lat: '43.098', lon: '141.343' },
  ])
  await enter(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('標題').fill('飯店退房，行李寄放到今晚住的民宿再出發去玩')
  await dialog.getByLabel('地點', { exact: true }).fill('民宿')
  await dialog.getByRole('button', { name: '找地點' }).click()
  await dialog.getByRole('button', { name: /札幌市/ }).click()
  await dialog.getByRole('button', { name: '儲存' }).click()
  await expect(dialog).toHaveCount(0)

  const card = page.getByTestId('item-card').filter({ hasText: '飯店退房' })
  const heading = (await card.getByRole('heading').boundingBox())!
  const badge = (await card.getByLabel('地圖上的 1 號').boundingBox())!
  // 標題確實換行了，編號貼著第一行而不是垂直置中
  expect(heading.height).toBeGreaterThan(40)
  expect(badge.y - heading.y).toBeLessThan(8)
})
