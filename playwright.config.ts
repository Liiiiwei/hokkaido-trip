import { defineConfig } from '@playwright/test'

process.loadEnvFile('.env.local')

// 驗收用另一個資料檔，不動大家正在用的 trip.json。
// 測試程式與開發伺服器都要讀到同一個設定，所以兩邊都設
const DATA_PATH = 'trip.e2e.json'
process.env.NEXT_PUBLIC_DATA_PATH = DATA_PATH

const PORT = 3211

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    env: { NEXT_PUBLIC_DATA_PATH: DATA_PATH },
    // 一定要自己起一個帶著上面設定的伺服器，不能沿用平常開發用的那個
    reuseExistingServer: false,
  },
})
