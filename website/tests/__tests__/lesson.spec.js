import { test, expect } from '../fixtures.js'

test('lesson page visual test', async ({ page }) => {
  await page.goto('/learn/01-the-document')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('lesson.png', {
    fullPage: true
  })
})
