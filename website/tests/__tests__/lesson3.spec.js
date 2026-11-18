import { test, expect } from '../fixtures.js'

test('lesson 3 visual test', async ({ page }) => {
  await page.goto('/learn/03-attributes-data')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('lesson3.png', {
    fullPage: true
  })
})
