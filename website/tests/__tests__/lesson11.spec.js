import { test, expect } from '../fixtures.js'

test('lesson 11 visual test', async ({ page }) => {
  await page.goto('/learn/11-server-side-rendering')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('lesson11.png', {
    fullPage: true
  })
})
