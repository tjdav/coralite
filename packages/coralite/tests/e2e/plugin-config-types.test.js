import { waitForHydration } from './helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Plugin Config Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/config-types/')
    await waitForHydration(page)
  })

  test('should correctly serialize and deserialize non-JSON types in plugin config', async ({ page }) => {
    await expect(page.getByTestId('regex')).toHaveText('is-regex')
    await expect(page.getByTestId('date')).toHaveText('is-date')
    await expect(page.getByTestId('func')).toHaveText('3')
    await expect(page.getByTestId('map')).toHaveText('value')
    await expect(page.getByTestId('set')).toHaveText('true')
  })
})
