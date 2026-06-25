import { test, expect } from '@playwright/test'

test.describe('Deep Nested Imperative Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/deep-nested-imperative/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should load recursively nested imperative components', async ({ page }) => {
    const parent = page.locator('deep-parent')
    await expect(parent).toBeVisible()

    const level1 = parent.locator('deep-level-1[depth="1"]')
    await expect(level1).toBeVisible()
    // Use data-testid consistently
    await expect(level1.locator('> [data-testid$="__container"] > [data-testid$="__label"]')).toHaveText('Level 1')

    const level2 = level1.locator('deep-level-1[depth="2"]')
    await expect(level2).toBeVisible()
    await expect(level2.locator('> [data-testid$="__container"] > [data-testid$="__label"]')).toHaveText('Level 2')

    const level3 = level2.locator('deep-level-1[depth="3"]')
    await expect(level3).toBeVisible()
    await expect(level3.locator('> [data-testid$="__container"] > [data-testid$="__label"]')).toHaveText('Level 3')

    // Level 4 should NOT exist
    const level4 = level3.locator('deep-level-1[depth="4"]')
    await expect(level4).not.toBeAttached()
  })
})
