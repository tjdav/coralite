import { test, expect } from '../fixtures.js'

test('compare page visual test', async ({ page }) => {
  await page.goto('/compare')
  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('compare.png', {
    fullPage: true
  })
})
