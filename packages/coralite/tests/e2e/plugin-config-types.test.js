import { test, expect } from '@playwright/test'

test.describe('Plugin Config Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/config-types/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should correctly serialize and deserialize non-JSON types in plugin config', async ({ page }) => {
    await expect(page.getByTestId('regex')).toHaveText('is-regex')
    await expect(page.getByTestId('date')).toHaveText('is-date')
    await expect(page.getByTestId('func')).toHaveText('3')
    await expect(page.getByTestId('map')).toHaveText('value')
    await expect(page.getByTestId('set')).toHaveText('true')
  })
})
