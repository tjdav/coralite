import { test, expect } from '../fixtures.js'

test('lesson 4 visual test', async ({ page }) => {
  await page.goto('/learn/04-structuring-a-page')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('lesson4.png', {
    fullPage: true
  })
})
