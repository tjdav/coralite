import { waitForHydration } from '../../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Async Dependency Resolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/async-deps-test/')
    await waitForHydration(page)
  })

  test('should track dependencies in async getters after resolution', async ({ page }) => {
    const comp = page.locator('async-deps-test-comp').first()
    const loadDataBtn = comp.locator('.load-data-btn')
    const statusDisplay = comp.locator('.async-status-display')
    const derivedDisplay = comp.locator('.derived-from-async-display')

    // Initial state
    await expect(derivedDisplay).toHaveText('Derived: No data')

    // Load async data
    await loadDataBtn.click()

    // Wait for async operation
    await expect(statusDisplay).toHaveText('Status: Loaded')

    // Derived getter should update after async data resolves
    await expect(derivedDisplay).toHaveText('Derived: Processed: 84')
  })
})
