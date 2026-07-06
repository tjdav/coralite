import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Boolean Attributes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/boolean-attributes/')
    await waitForHydration(page)
  })

  test('should handle boolean attributes correctly during SSR and hydration', async ({ page }) => {
    // First instance: is-checked="true" is-disabled="false"
    const comp1 = page.locator('boolean-attr-component').nth(0)
    const checkbox1 = comp1.locator('input[type="checkbox"]')
    const btn1 = comp1.locator('button').first()
    await expect(checkbox1).toBeChecked()
    await expect(btn1).toBeEnabled()

    // Second instance: is-checked="false" is-disabled="true"
    const comp2 = page.locator('boolean-attr-component').nth(1)
    const checkbox2 = comp2.locator('input[type="checkbox"]')
    const btn2 = comp2.locator('button').first()
    await expect(checkbox2).not.toBeChecked()
    await expect(btn2).toBeDisabled()
  })

  test('should update boolean attributes reactively on the client', async ({ page }) => {
    const comp = page.locator('boolean-attr-component').nth(0)
    const checkbox = comp.locator('input[type="checkbox"]')
    const toggleBtn = comp.locator('button').nth(1)

    // Initially checked
    await expect(checkbox).toBeChecked()

    // Click toggle button to uncheck
    await toggleBtn.click()
    await expect(checkbox).not.toBeChecked()

    // Click again to check
    await toggleBtn.click()
    await expect(checkbox).toBeChecked()
  })
})
