import { test, expect } from '@playwright/test'

test.describe('Shorthand Method Serialization', () => {
  test('should correctly serialize shorthand ES6 method inside defaultValues and execute it on the client', async ({ page }) => {
    await page.goto('/shorthand-method-page.html')

    const messageSpan = page.locator('span')
    await expect(messageSpan).toBeVisible()
    await expect(messageSpan).toHaveText('Hello from client!')
  })
})
