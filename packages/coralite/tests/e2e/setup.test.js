import { test, expect } from '@playwright/test'

test.describe('Setup Function', () => {
  test('should resolve async data in setup', async ({ page }) => {
    await page.goto('/forecast.html')

    const currents = page.locator('.currents')
    await expect(currents).toContainText('Direction: East Australian Current')
    await expect(currents).toContainText('Speed: Fast')
  })
})
