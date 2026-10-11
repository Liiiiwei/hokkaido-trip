import { expect, test, type Page } from '@playwright/test'

// 手機上的手勢與行為。這個檔案不碰真的 GitHub：用記憶體裡的假資料檔回應
test.use({ hasTouch: true })

type Seed = {
  trip: { title: string; start_date: string; end_date: string }
  days: unknown[]
  items: Record<string, unknown>[]
  itemMembers: unknown[]
}

const item = (over: Record<string, unknown>) => ({
  day: '2030-05-01',
  start_time: null,
  end_time: null,
  place: '',
  note: '',
  kind: 'all',
  created_by: '測試',
  updated_at: '2030-01-01T00:00:00Z',
  ...over,
})

const seedOf = (items: Record<string, unknown>[]): Seed => ({
  trip: { title: '測試旅程', start_date: '2030-05-01', end_date: '2030-05-03' },
  days: [],
  items,
  itemMembers: [],
})

// 回傳的 file 讓測試可以直接看存進去的內容；down 設成 true 之後 GitHub 就連不上
async function mockGitHub(page: Page, seed: Seed) {
  const file = { text: JSON.stringify(seed), version: 1, down: false, denied: false }
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
  }
  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request()
    if (file.down) return route.abort()
    if (file.denied) return route.fulfill({ status: 401, headers: cors, body: '{}' })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({
          content: Buffer.from(file.text, 'utf8').toString('base64'),
          sha: String(file.version),
        }),
      })
    }
    const body = JSON.parse(request.postData() ?? '{}')
    if (body.sha !== String(file.version)) {
      return route.fulfill({ status: 409, headers: cors, body: '{}' })
    }
    file.text = Buffer.from(body.content, 'base64').toString('utf8')
    file.version += 1
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' })
  })
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort())
  await page.route('https://router.project-osrm.org/**', (route) => route.abort())
  return file
}

// 這台電腦的系統設定開了「減少動態」，手機上大多沒開；測試要明確指定才測得到跟手與歸位的動畫
async function fullMotion(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  })
}

async function enter(page: Page) {
  await fullMotion(page)
  await page.goto('/#k=fake_key')
  await page.getByPlaceholder('你的名字或暱稱').fill('測試')
  await page.getByRole('button', { name: '進入行程' }).click()
  await expect(page.getByRole('navigation', { name: '日期' })).toBeVisible()
}

// 用手指從一點滑到另一點。holdMs 是按下後先停多久（長按）
async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  holdMs = 0,
) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  if (holdMs) await page.waitForTimeout(holdMs)
  const steps = 10
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / steps,
          y: from.y + ((to.y - from.y) * step) / steps,
        },
      ],
    })
    await page.waitForTimeout(16)
  }
  // 放手前停一下，放手時的速度是零，結果只看拖了多遠
  await page.waitForTimeout(150)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

async function centerOf(page: Page, testIdOrLocator: ReturnType<Page['locator']>) {
  const box = await testIdOrLocator.boundingBox()
  if (!box) throw new Error('找不到元素')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const activeDay = (page: Page) =>
  page.getByRole('navigation', { name: '日期' }).locator('[aria-pressed="true"]')

const titles = (page: Page) => page.getByTestId('item-card').locator('h3').allTextContents()

test('卡片往左滑露出編輯與刪除；刪除要按兩次才真的刪', async ({ page }) => {
  const file = await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步', start_time: '10:00' })]))
  await enter(page)
  const card = page.getByTestId('item-card')
  const remove = page.getByRole('button', { name: '刪除 運河散步' })
  // 收著的時候碰不到
  await expect(remove).toHaveCount(0)

  const c = await centerOf(page, card)
  await touchDrag(page, c, { x: c.x - 150, y: c.y })
  await expect(remove).toBeVisible()
  await expect(page.getByRole('button', { name: '編輯', exact: true })).toBeVisible()
  // 滑的過程沒有換日
  await expect(activeDay(page)).toContainText('5/1')

  await remove.click()
  await expect(page.getByTestId('item-card')).toHaveCount(1)
  await page.getByRole('button', { name: '確定刪除 運河散步' }).click()
  await expect(page.getByTestId('item-card')).toHaveCount(0)
  expect(JSON.parse(file.text).items).toHaveLength(0)
})

test('露出動作後按編輯會開編輯面板；碰別的地方會收回去', async ({ page }) => {
  await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步', start_time: '10:00' })]))
  await enter(page)
  const c = await centerOf(page, page.getByTestId('item-card'))

  await touchDrag(page, c, { x: c.x - 150, y: c.y })
  await page.getByTestId('stay-card').tap()
  await expect(page.getByRole('button', { name: '刪除 運河散步' })).toHaveCount(0)

  await touchDrag(page, c, { x: c.x - 150, y: c.y })
  await page.getByRole('button', { name: '編輯', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '編輯行程' })).toBeVisible()
  await expect(page.getByLabel('標題')).toHaveValue('運河散步')
})

test('卡片以外的地方左右滑會換日；到頭了不會再換', async ({ page }) => {
  await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步', start_time: '10:00' })]))
  await enter(page)
  await expect(activeDay(page)).toContainText('5/1')
  const c = await centerOf(page, page.getByTestId('stay-card'))

  // 第一天再往右滑（上一天）沒有東西可以換
  await touchDrag(page, c, { x: c.x + 220, y: c.y })
  await expect(activeDay(page)).toContainText('5/1')

  await touchDrag(page, c, { x: c.x - 220, y: c.y })
  await expect(activeDay(page)).toContainText('5/2')
  await expect(page.getByText('這天還沒有行程')).toBeVisible()

  await touchDrag(page, c, { x: c.x + 220, y: c.y })
  await expect(activeDay(page)).toContainText('5/1')
  await expect(page.getByTestId('item-card')).toHaveCount(1)

  // 滑一點點就放手：不換
  await touchDrag(page, c, { x: c.x - 40, y: c.y })
  await expect(activeDay(page)).toContainText('5/1')
})

test('沒填時間的行程可以拖握把調先後，順序會存起來；有時間的行程沒有握把', async ({ page }) => {
  const file = await mockGitHub(
    page,
    seedOf([
      item({ id: 't', title: '早餐', start_time: '08:00' }),
      item({ id: 'a', title: 'A 買伴手禮' }),
      item({ id: 'b', title: 'B 泡湯' }),
      item({ id: 'c', title: 'C 拉麵' }),
    ]),
  )
  await enter(page)
  expect(await titles(page)).toEqual(['早餐', 'A 買伴手禮', 'B 泡湯', 'C 拉麵'])
  const cards = page.getByTestId('item-card')
  await expect(cards.filter({ hasText: '早餐' }).locator('[data-grip]')).toHaveCount(0)

  // 把 A 拖到 C 後面
  const grip = await centerOf(page, cards.filter({ hasText: 'A 買伴手禮' }).locator('[data-grip]'))
  const last = await centerOf(page, cards.filter({ hasText: 'C 拉麵' }))
  await touchDrag(page, grip, { x: grip.x, y: last.y + 20 })

  await expect.poll(() => titles(page)).toEqual(['早餐', 'B 泡湯', 'C 拉麵', 'A 買伴手禮'])
  await expect
    .poll(() => {
      const saved = JSON.parse(file.text).items as { id: string; order?: number }[]
      return Object.fromEntries(saved.map((i) => [i.id, i.order]))
    })
    .toEqual({ t: undefined, b: 0, c: 1, a: 2 })

  // 重新整理後順序還在
  await page.reload()
  await expect.poll(() => titles(page)).toEqual(['早餐', 'B 泡湯', 'C 拉麵', 'A 買伴手禮'])
})

test('長按卡片也能拿起來拖；拖的時候頁面不會跟著捲', async ({ page }) => {
  await mockGitHub(
    page,
    seedOf([item({ id: 'a', title: 'A 買伴手禮' }), item({ id: 'b', title: 'B 泡湯' })]),
  )
  await enter(page)
  const cards = page.getByTestId('item-card')
  const from = await centerOf(page, cards.filter({ hasText: 'B 泡湯' }).locator('h3'))
  const to = await centerOf(page, cards.filter({ hasText: 'A 買伴手禮' }))

  await touchDrag(page, from, { x: from.x, y: to.y - 20 }, 650)
  await expect.poll(() => titles(page)).toEqual(['B 泡湯', 'A 買伴手禮'])
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
})

test('順序存不成時還原成原本的順序，並顯示原因', async ({ page }) => {
  const file = await mockGitHub(
    page,
    seedOf([item({ id: 'a', title: 'A 買伴手禮' }), item({ id: 'b', title: 'B 泡湯' })]),
  )
  await enter(page)
  const cards = page.getByTestId('item-card')
  file.down = true
  const grip = await centerOf(page, cards.filter({ hasText: 'A 買伴手禮' }).locator('[data-grip]'))
  const last = await centerOf(page, cards.filter({ hasText: 'B 泡湯' }))
  await touchDrag(page, grip, { x: grip.x, y: last.y + 20 })

  await expect(page.getByText(/順序沒存成功/)).toBeVisible()
  expect(await titles(page)).toEqual(['A 買伴手禮', 'B 泡湯'])
})

test('今天的行程會標出下一站或進行中', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2030, 4, 2, 10, 30))
  await mockGitHub(
    page,
    seedOf([
      item({ id: 'a', day: '2030-05-02', title: '早市', start_time: '09:00', end_time: '10:00' }),
      item({ id: 'b', day: '2030-05-02', title: '運河', start_time: '11:00', end_time: '12:00' }),
      item({ id: 'c', day: '2030-05-02', title: '晚餐', start_time: '18:00' }),
      item({ id: 'd', day: '2030-05-01', title: '昨天的事', start_time: '11:00' }),
    ]),
  )
  await enter(page)
  // 打開就是今天
  await expect(activeDay(page)).toContainText('5/2')
  const badge = page.getByTestId('live-badge')
  await expect(badge).toHaveCount(1)
  await expect(badge).toHaveText('下一站')
  await expect(page.getByTestId('item-card').filter({ has: badge })).toContainText('運河')

  // 時間走到行程裡面，變成進行中
  await page.clock.setFixedTime(new Date(2030, 4, 2, 11, 20))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(badge).toHaveText('進行中')

  // 別天不標
  await page.getByRole('navigation', { name: '日期' }).getByRole('button', { name: /5\/1/ }).click()
  await expect(page.getByTestId('item-card')).toContainText('昨天的事')
  await expect(badge).toHaveCount(0)
})

test('今天行程很多時，打開就捲到下一站', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2030, 4, 2, 19, 30))
  const hours = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '20']
  await mockGitHub(
    page,
    seedOf(
      hours.map((h) =>
        item({ id: h, day: '2030-05-02', title: `${h} 點的行程`, start_time: `${h}:00`, note: '備註' }),
      ),
    ),
  )
  await enter(page)
  const next = page.getByTestId('item-card').filter({ has: page.getByTestId('live-badge') })
  await expect(next).toContainText('20 點的行程')
  await expect(next).toBeInViewport()
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
  // 沒有被頂部列蓋住
  const top = (await next.boundingBox())!.y
  const headerBottom = await page.locator('header').evaluate((el) => el.getBoundingClientRect().bottom)
  expect(top).toBeGreaterThanOrEqual(headerBottom)
})

test('連不上網路時，重新打開仍看得到上次的行程', async ({ page }) => {
  const file = await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步', start_time: '10:00' })]))
  await enter(page)
  await expect(page.getByTestId('item-card')).toContainText('運河散步')

  file.down = true
  await page.reload()
  await expect(page.getByTestId('item-card')).toContainText('運河散步')
  await expect(page.getByRole('status')).toContainText('連線中斷')

  // 網路回來後自動接上
  file.down = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('深色模式：底色與卡片變深、字變亮，主要按鈕仍是藍底白字', async ({ page }) => {
  await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步', start_time: '10:00' })]))
  await enter(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  })
  const bg = (el: Element) => getComputedStyle(el).backgroundColor
  const color = (el: Element) => getComputedStyle(el).color
  const channels = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)

  expect(await page.locator('body').evaluate(bg)).toBe('rgb(11, 18, 32)')
  const card = page.getByTestId('item-card')
  for (const value of channels(await card.evaluate(bg))) expect(value).toBeLessThan(60)
  for (const value of channels(await card.locator('h3').evaluate(color))) {
    expect(value).toBeGreaterThan(200)
  }
  for (const value of channels(await page.locator('header').evaluate(bg))) {
    expect(value).toBeLessThan(60)
  }
  const add = page.getByRole('button', { name: '新增行程', exact: true })
  // 按鈕換色有一小段漸變，等它到位
  await expect.poll(() => add.evaluate(bg)).toBe('rgb(53, 101, 224)')
  for (const value of channels(await add.evaluate(color))) expect(value).toBeGreaterThan(230)

  // 面板和輸入框也跟著變深
  await add.click()
  const dialog = page.getByRole('dialog')
  for (const value of channels(await dialog.evaluate(bg))) expect(value).toBeLessThan(60)
  for (const value of channels(await dialog.getByLabel('標題').evaluate(bg))) {
    expect(value).toBeLessThan(60)
  }
})

test('當天地圖收起與展開：收起後地圖拿掉，展開後回來', async ({ page }) => {
  await mockGitHub(
    page,
    seedOf([item({ id: 'a', title: '運河散步', start_time: '10:00', lat: 43.199, lng: 141.001 })]),
  )
  await enter(page)
  const toggle = page.getByRole('button', { name: /當天地圖/ })
  const map = page.getByLabel('地圖', { exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(map).toBeVisible()

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(map).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(map).toBeVisible()
  await expect.poll(async () => (await map.boundingBox())?.height ?? 0).toBeGreaterThan(200)
})

test('沒有鑰匙時，把連結貼進欄位就進得來', async ({ page }) => {
  await mockGitHub(page, seedOf([]))
  await page.goto('/')
  await expect(page.getByText('請用群組裡的完整連結開啟')).toBeVisible()
  const field = page.getByLabel('或把連結貼在這裡')
  const go = page.getByRole('button', { name: '用這個連結進入' })

  await field.fill('https://example.com/trip/')
  await go.click()
  await expect(page.getByText('這段文字裡找不到通行資訊')).toBeVisible()

  await field.fill('行程在這 https://example.com/trip/#k=fake_key')
  await go.click()
  await expect(page.getByPlaceholder('你的名字或暱稱')).toBeVisible()
})

test('貼到進不去的連結不會被存下來；連結失效的畫面也能貼新連結進來', async ({ page }) => {
  const file = await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步' })]))
  file.denied = true
  await page.goto('/')
  const field = page.getByLabel('或把連結貼在這裡')
  const go = page.getByRole('button', { name: '用這個連結進入' })
  await field.fill('https://example.com/trip/#k=cut_off')
  await go.click()
  await expect(page.getByText('這個連結進不去')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('hokkaido-trip:key'))).toBeNull()

  // 原本進得來，後來主揪換了鑰匙
  file.denied = false
  await enter(page)
  await expect(page.getByTestId('item-card')).toContainText('運河散步')
  file.denied = true
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText('連結失效')).toBeVisible()

  file.denied = false
  await page.getByLabel('或把連結貼在這裡').fill('https://example.com/trip/#k=new_key')
  await page.getByRole('button', { name: '用這個連結進入' }).click()
  await expect(page.getByTestId('item-card')).toContainText('運河散步')
  expect(await page.evaluate(() => localStorage.getItem('hokkaido-trip:key'))).toBe('new_key')
})

test('資料檔壞掉時，就算手機裡有上次的行程也會說明', async ({ page }) => {
  const file = await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步' })]))
  await enter(page)
  await expect(page.getByTestId('item-card')).toContainText('運河散步')
  file.text = '{"trip":'
  file.version += 1
  await page.reload()
  await expect(page.getByText('行程資料檔格式壞了')).toBeVisible()
})

test('全員行程調順序後，放下的卡片不會重播進場動畫', async ({ page }) => {
  await mockGitHub(
    page,
    seedOf([item({ id: 'a', title: 'A 買伴手禮' }), item({ id: 'b', title: 'B 泡湯' })]),
  )
  await enter(page)
  const cards = page.getByTestId('item-card')
  // 等進場動畫播完
  await expect(page.locator('li.rise')).toHaveCount(0)
  const grip = await centerOf(page, cards.filter({ hasText: 'A 買伴手禮' }).locator('[data-grip]'))
  const last = await centerOf(page, cards.filter({ hasText: 'B 泡湯' }))
  await touchDrag(page, grip, { x: grip.x, y: last.y + 20 })
  await expect.poll(() => titles(page)).toEqual(['B 泡湯', 'A 買伴手禮'])
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
  // 其他卡片沒有留著讓位時的位移
  expect(
    await cards.evaluateAll((els) => els.map((el) => (el.parentElement as HTMLElement).style.transform)),
  ).toEqual(['', ''])
})

test('面板裡捲到底不帶動後面的頁面；按鈕長按不會反白文字，內文仍可選取', async ({ page }) => {
  await mockGitHub(page, seedOf([item({ id: 'a', title: '運河散步', start_time: '10:00', place: '小樽' })]))
  await enter(page)
  const select = (el: Element) => getComputedStyle(el).userSelect
  const add = page.getByRole('button', { name: '新增行程', exact: true })
  expect(await add.evaluate(select)).toBe('none')
  expect(await page.getByTestId('item-card').locator('h3').evaluate(select)).not.toBe('none')
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe(
    'none',
  )

  await add.click()
  const dialog = page.getByRole('dialog')
  expect(await dialog.evaluate((el) => getComputedStyle(el).overscrollBehaviorY)).toBe('contain')
  // 輸入框的字不小於 16px，iPhone 才不會自動放大畫面
  const size = await dialog.getByLabel('標題').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(16)
})
