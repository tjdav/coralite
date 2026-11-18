import { test, expect } from '../fixtures.js'

test('homepage visual test', async ({ page }) => {
  await page.goto('/')
  
  // Wait for fonts and hydration
  await page.waitForLoadState('networkidle')
  
  // Take a full page screenshot
  await expect(page).toHaveScreenshot('homepage.png', {
    fullPage: true
  })
})
