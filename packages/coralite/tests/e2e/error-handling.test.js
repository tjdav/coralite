import { test, expect } from '@playwright/test'

test.describe('Error Handling', () => {
  // We can't easily test an error that crashes the build via E2E.
  // We test the non-crashing component in the build to ensure the build finishes,
  // but to verify the onError logic, we can just assert that the normal page didn't throw during runtime.
  // A unit test would be better for actual crash handling, but we can verify the error-component renders its base fallback.

  test('should render base html when error component does not crash runtime', async ({ page }) => {
    await page.goto('/error-handling/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)


    // the component doesn't actually throw because context.state.triggerError is not set
    await expect(page.locator('body')).toContainText('Error test')
  })
})
