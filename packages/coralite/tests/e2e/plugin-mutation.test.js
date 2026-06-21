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
    const comp = page.locator('mutation-test-component')
    const instanceId = await comp.getAttribute('data-cid')
    const serverResult = page.getByTestId(`${instanceId}__server-result`)
    await expect(serverResult).toHaveText('Server Data from DB')
  })

  test('should verify client-side mutation resolution (Hydration & Interactivity)', async ({ page }) => {
    const comp = page.locator('mutation-test-component')
    const instanceId = await comp.getAttribute('data-cid')
    const clientResult = page.getByTestId(`${instanceId}__client-result`)
    const actionButton = page.getByTestId(`${instanceId}__client-action`)

    // Verify initial state
    await expect(clientResult).toHaveText('Initial Client State')

    // Click button to trigger client-side mutation usage
    await actionButton.click()

    // Verify updated state from client utility resolved via mutation
    await expect(clientResult).toHaveText('Client Action Performed')
  })
})
