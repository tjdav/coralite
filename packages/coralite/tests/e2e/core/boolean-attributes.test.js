import { waitForHydration, isProduction } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Boolean Attributes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/boolean-attributes/')
    await waitForHydration(page)
  })

  test('should handle boolean attributes correctly during SSR and hydration', async ({ page }) => {
    // First instance: is-checked="true" is-disabled="false" is-pay="true" is-expanded="true" aria-label="Action button"
    const comp1 = page.locator('boolean-attr-component').nth(0)
    const checkbox1 = comp1.locator('input[type="checkbox"]')
    const btn1 = comp1.locator('button').first()
    await expect(checkbox1).toBeChecked()
    await expect(btn1).toBeEnabled()
    await expect(btn1).toHaveAttribute('allowpaymentrequest', '')
    await expect(btn1).toHaveAttribute('aria-expanded', 'true')
    await expect(btn1).toHaveAttribute('aria-label', 'Action button')

    // Second instance: is-checked="false" is-disabled="true" is-pay="false" is-expanded="false"
    const comp2 = page.locator('boolean-attr-component').nth(1)
    const checkbox2 = comp2.locator('input[type="checkbox"]')
    const btn2 = comp2.locator('button').first()
    await expect(checkbox2).not.toBeChecked()
    await expect(btn2).toBeDisabled()
    await expect(btn2).not.toHaveAttribute('allowpaymentrequest')
    await expect(btn2).not.toHaveAttribute('aria-expanded')
    await expect(btn2).not.toHaveAttribute('aria-label')
  })

  test('should update boolean and aria attributes reactively on the client', async ({ page }) => {
    const comp = page.locator('boolean-attr-component').nth(0)
    const checkbox = comp.locator('input[type="checkbox"]')
    const btn1 = comp.locator('button').first()
    const toggleBtn = comp.locator('button').nth(1)

    // Initially checked and aria-expanded="true"
    await expect(checkbox).toBeChecked()
    await expect(btn1).toHaveAttribute('aria-expanded', 'true')

    // Click toggle button to uncheck and set aria-expanded to false (removed from DOM)
    await toggleBtn.click()
    await expect(checkbox).not.toBeChecked()
    await expect(btn1).not.toHaveAttribute('aria-expanded')

    // Click again to check and restore aria-expanded="true"
    await toggleBtn.click()
    await expect(checkbox).toBeChecked()
    await expect(btn1).toHaveAttribute('aria-expanded', 'true')
  })

  test('should handle ref and data-testid on the same element', async ({ page }, testInfo) => {
    const comp = page.locator('boolean-attr-component').first()

    // We expect the button to have the correct ref attribute prefixed in all modes
    const button = comp.locator('button').nth(1)

    if (isProduction(testInfo)) {
      // In production, data-testid must be stripped, but ref must exist and be prefixed
      await expect(button).toHaveAttribute('ref', /boolean-attr-component-\d+__toggle-btn/)
      await expect(button).not.toHaveAttribute('data-testid')
    } else {
      // In non-production, both ref and data-testid must exist and be prefixed
      await expect(button).toHaveAttribute('ref', /boolean-attr-component-\d+__toggle-btn/)

      const testIdButton = page.getByTestId(/boolean-attr-component-\d+__toggle-btn/).first()
      await expect(testIdButton).toBeVisible()
    }
  })
})
