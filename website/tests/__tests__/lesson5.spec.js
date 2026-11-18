import { test, expect } from '../fixtures.js'

test('lesson 5 visual test', async ({ page }) => {
  await page.goto('/learn/05-native-css-scoping')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('lesson5.png', {
    fullPage: true
  })
})
