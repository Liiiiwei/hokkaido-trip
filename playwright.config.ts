import { defineConfig } from '@playwright/test'

process.loadEnvFile('.env.local')

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:3210',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3210',
    reuseExistingServer: true,
  },
})
