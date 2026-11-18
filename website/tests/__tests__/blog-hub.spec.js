import { test, expect } from '../fixtures.js'

test('blog hub visual test', async ({ page }) => {
  await page.goto('/blog/')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('blog-hub.png', {
    fullPage: true
  })
})
