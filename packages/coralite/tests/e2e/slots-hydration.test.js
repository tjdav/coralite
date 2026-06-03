import { test, expect } from '@playwright/test'

test.describe('Slots Hydration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slots-hydration/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should hydrate and update reactive slot content', async ({ page }) => {
    const parentCount = page.locator('#parent-count')
    const projectedCount = page.locator('#projected-count')
    const incrementBtn = page.locator('#increment-btn')

    // Initial state (server rendered)
    await expect(parentCount).toHaveText('0')
    await expect(projectedCount).toHaveText('0')

    // Reactive update
    await incrementBtn.click()
    await expect(parentCount).toHaveText('1')
    await expect(projectedCount).toHaveText('1')
  })

  test('should preserve server-side transformations during hydration', async ({ page }) => {
    const projectedContent = page.locator('#projected-content')

    // Check for class and attribute added by server-side slot transformation
    await expect(projectedContent).toHaveClass(/transformed-slot/)
    await expect(projectedContent).toHaveAttribute('data-server-transformed', 'true')
  })

  test('should hydrate nested components projected into slots', async ({ page }) => {
    const nestedVal = page.locator('#nested-val')
    const nestedBtn = page.locator('#nested-btn')

    // Initial state
    await expect(nestedVal).toHaveText('10')

    // Reactive update in nested component
    await nestedBtn.click()
    await expect(nestedVal).toHaveText('11')
  })
})
