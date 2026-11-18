import { test, expect } from '../fixtures.js'

test('404 page visual test', async ({ page }) => {
  await page.goto('/404')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('404.png', {
    fullPage: true
  })
})
