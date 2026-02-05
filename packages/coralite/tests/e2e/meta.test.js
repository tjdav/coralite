import { test, expect } from '@playwright/test'

test.describe('Meta Data', () => {
  test('should render meta data in component', async ({ page }) => {
    await page.goto('/meta-page.html')
    const metaInfo = page.locator('.meta-info')
    await expect(metaInfo).toBeVisible()
    await expect(metaInfo).toContainText('Nemo')
    await expect(metaInfo).toContainText('2026-02-05T13:46:34.852Z')
    await expect(metaInfo).toContainText('2026-02-06T13:46:34.852Z')
  })
})
