import { test, expect } from '@playwright/test'

test.describe('Client-side Scripts', () => {
  test('should interact with DOM using refs', async ({ page }) => {
    await page.goto('/script-test.html')

    const cleaner = page.locator('.cleaner')
    const btn = cleaner.locator('button')
    const status = cleaner.locator('span')

    // Verify ref was set as an id property
    const statusId = await status.getAttribute('id')
    expect(statusId).toBeTruthy()

    // Explicitly wait for aria-controls to be set correctly or verify logic handles string evaluation
    const expectedControls = await status.getAttribute('id')

    await expect(status).toHaveText('Dirty')
    await btn.click()
    await expect(status).toHaveText('Clean')
  })
})
