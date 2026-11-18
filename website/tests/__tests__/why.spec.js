import { test, expect } from '../fixtures.js'

test('why page visual test', async ({ page }) => {
  await page.goto('/why')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('why.png', {
    fullPage: true
  })
})
