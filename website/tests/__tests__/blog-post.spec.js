import { test, expect } from '../fixtures.js'

test('blog post visual test', async ({ page }) => {
  await page.goto('/blog/ai-versioning-trap.html')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('blog-post.png', {
    fullPage: true
  })
})
