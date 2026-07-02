// @ts-check
import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'line',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry'
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'framework-core-dev',
      testDir: './tests/e2e/core',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000'
      }
    },
    {
      name: 'framework-core-prod',
      testDir: './tests/e2e/core',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001'
      }
    },
    {
      name: 'testing-mode-features',
      testDir: './tests/e2e/testing-mode',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3002'
      }
    }
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'pnpm run server:dev',
      port: 3000,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm run server:prod',
      port: 3001,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm run server:testing',
      port: 3002,
      reuseExistingServer: !process.env.CI
    }
  ]
})
