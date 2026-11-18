import { defineConfig, devices } from '@playwright/test'

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3333
const externalBaseURL = process.env.BASE_URL
const fullAudit = Boolean(process.env.A11Y_FULL)
const baseURL = externalBaseURL || `http://localhost:${port}`

export default defineConfig({
  testDir: './tests/__tests__',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      // Arrow glyphs (U+2192) are not part of the self-hosted font subsets, so
      // Chromium resolves them from a system font that differs between the
      // development machine and the CI runner. The budget covers glyph-level
      // variance (observed max ~1.7k px) while staying far below the tens of
      // thousands of pixels a layout regression produces.
      maxDiffPixels: 2500
    }
  },
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: externalBaseURL
    ? undefined
    : {
      command: fullAudit ? 'node scripts/serve-dist.js' : 'pnpm coralite dev',
      url: baseURL,
      reuseExistingServer: fullAudit ? false : !process.env.CI,
      timeout: 120 * 1000
    }
})
