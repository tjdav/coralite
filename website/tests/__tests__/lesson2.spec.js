import { test, expect } from '../fixtures.js'

test('lesson 2 visual test', async ({ page }) => {
  await page.goto('/learn/02-semantic-tags')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('lesson2.png', {
    fullPage: true
  })
})
