import { test, expect } from '../fixtures.js'

test('lesson 10 visual test', async ({ page }) => {
  await page.goto('/learn/10-reactive-state')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('lesson10.png', {
    fullPage: true
  })
})
