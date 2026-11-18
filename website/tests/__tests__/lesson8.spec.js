import { test, expect } from '../fixtures.js'

test('lesson 8 visual test', async ({ page }) => {
  await page.goto('/learn/08-the-client-runtime')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('lesson8.png', {
    fullPage: true
  })
})
