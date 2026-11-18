import { test, expect } from '../fixtures.js'

test('lesson 6 visual test', async ({ page }) => {
  await page.goto('/learn/06-cascade-layers')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('lesson6.png', {
    fullPage: true
  })
})
