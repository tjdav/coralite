import { test, expect } from '../fixtures.js'

test('learning hub visual test', async ({ page }) => {
  await page.goto('/learn/')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('learn-hub.png', {
    fullPage: true
  })
})
