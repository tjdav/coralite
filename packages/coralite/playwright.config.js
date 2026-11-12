// @ts-check
import { defineConfig, devices } from '@playwright/test'
import { E2E_BASE_URLS, E2E_PORTS } from './tests/e2e/ports.js'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: Boolean(process.env.CI),
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
      testIgnore: /router\.spec\.js$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: E2E_BASE_URLS.dev
      }
    },
    {
      name: 'framework-core-prod',
      testDir: './tests/e2e/core',
      testIgnore: /router\.spec\.js$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: E2E_BASE_URLS.prod
      }
    },
    {
      name: 'testing-mode-features',
      testDir: './tests/e2e/testing-mode',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: E2E_BASE_URLS.testing
      }
    },
    {
      name: 'router-app-dev',
      testDir: './tests/e2e/core',
      testMatch: /router\.spec\.js$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: E2E_BASE_URLS.router
      }
    }
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'pnpm run e2e:server:dev',
      port: E2E_PORTS.dev,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm run e2e:server:prod',
      port: E2E_PORTS.prod,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm run e2e:server:testing',
      port: E2E_PORTS.testing,
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'pnpm run e2e:server:router',
      port: E2E_PORTS.router,
      reuseExistingServer: !process.env.CI
    }
  ]
})
