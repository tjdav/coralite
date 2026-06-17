import { test, expect } from '@playwright/test'

test.describe('InnerHTML Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/innerhtml-test/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should create components via innerHTML, outerHTML and insertAdjacentHTML', async ({ page }) => {
    const innerTitle = page.locator('[data-testid="title"]').nth(0)
    await expect(innerTitle).toHaveText('InnerHTML Mount')

    const outerTitle = page.locator('[data-testid="title"]').nth(1)
    await expect(outerTitle).toHaveText('OuterHTML Mount')

    const adjacentTitle = page.locator('[data-testid="title"]').nth(2)
    await expect(adjacentTitle).toHaveText('AdjacentHTML Mount')
  })
})
