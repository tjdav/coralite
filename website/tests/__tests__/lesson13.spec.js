import { test, expect } from '../fixtures.js'

test('lesson 13 visual test', async ({ page }) => {
  await page.goto('/learn/13-building-for-production')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('lesson13.png', {
    fullPage: true
  })
})
