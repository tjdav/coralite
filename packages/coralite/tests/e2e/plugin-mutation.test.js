import { test, expect } from '@playwright/test'

test.describe('Plugin Global Context Mutation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/mutation-test.html')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should verify server-side mutation resolution (SSR)', async ({ page }) => {
    const serverResult = page.locator('#server-result')
    await expect(serverResult).toHaveText('Server Data from DB')
  })

  test('should verify client-side mutation resolution (Hydration & Interactivity)', async ({ page }) => {
    const clientResult = page.locator('#client-result')
    const actionButton = page.locator('#client-action')

    // Verify initial state
    await expect(clientResult).toHaveText('Initial Client State')

    // Click button to trigger client-side mutation usage
    await actionButton.click()

    // Verify updated state from client utility resolved via mutation
    await expect(clientResult).toHaveText('Client Action Performed')
  })
})
