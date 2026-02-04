import { test, expect } from '@playwright/test'

test.describe('Client-side Scripts', () => {
  test('should interact with DOM using refs', async ({ page }) => {
    await page.goto('/aquarium.html')

    const cleaner = page.locator('.cleaner')
    const btn = cleaner.locator('button')
    const status = cleaner.locator('span')

    await expect(status).toHaveText('Dirty')
    await btn.click()
    await expect(status).toHaveText('Clean')
  })
})
