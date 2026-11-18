import { test, expect } from '../fixtures.js'

test('lesson 9 visual test', async ({ page }) => {
  await page.goto('/learn/09-refs-and-event-listeners')
  
  await page.waitForLoadState('networkidle')
  
  await expect(page).toHaveScreenshot('lesson9.png', {
    fullPage: true
  })
})
