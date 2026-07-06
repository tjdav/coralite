import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Plugin Config Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/config-types/')
    await waitForHydration(page)
  })

  test('should correctly serialize and deserialize non-JSON types in plugin config', async ({ page }) => {
    const comp = page.locator('config-types-component').first()
    await expect(comp.locator('div > div').nth(0)).toHaveText('is-regex')
    await expect(comp.locator('div > div').nth(1)).toHaveText('is-date')
    await expect(comp.locator('div > div').nth(2)).toHaveText('3')
    await expect(comp.locator('div > div').nth(3)).toHaveText('value')
    await expect(comp.locator('div > div').nth(4)).toHaveText('true')
  })
})
