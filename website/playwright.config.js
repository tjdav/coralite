import { defineConfig, devices } from '@playwright/test'

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333
const externalBaseURL = process.env.BASE_URL
const baseURL = externalBaseURL || `http://localhost:${port}`

export default defineConfig({
  testDir: './tests/__tests__',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixels: 600
    }
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'pnpm coralite dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
})
