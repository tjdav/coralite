import { test, expect } from '../fixtures.js'

test('lesson 7 visual test', async ({ page }) => {
  await page.goto('/learn/07-theming-with-variables')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('lesson7.png', {
    fullPage: true
  })
})
