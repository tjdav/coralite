import { test, expect } from '@playwright/test'

test.describe('Async Plugin Helpers', () => {
  test('should execute async phase1 and return synchronous phase2', async ({ page }) => {
    await page.goto('/async-helper.html')

    const target = page.locator('#async-target')

    await expect(target).toHaveText('async-phase1-result', { timeout: 5000 })
    await expect(target).toHaveAttribute('data-updated', 'true')
  })
})
