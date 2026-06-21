import { test, expect } from '@playwright/test'

test.describe('Boolean Attributes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/boolean-attributes/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should handle boolean attributes correctly during SSR and hydration', async ({ page }) => {
    // First instance: is-checked="true" is-disabled="false"
    const checkbox1 = page.getByTestId('boolean-attr-component-0__checkbox')
    const btn1 = page.getByTestId('boolean-attr-component-0__btn')
    await expect(checkbox1).toBeChecked()
    await expect(btn1).toBeEnabled()

    // Second instance: is-checked="false" is-disabled="true"
    const checkbox2 = page.getByTestId('boolean-attr-component-1__checkbox')
    const btn2 = page.getByTestId('boolean-attr-component-1__btn')
    await expect(checkbox2).not.toBeChecked()
    await expect(btn2).toBeDisabled()
  })

  test('should update boolean attributes reactively on the client', async ({ page }) => {
    const checkbox = page.getByTestId('boolean-attr-component-0__checkbox')
    const toggleBtn = page.getByTestId('boolean-attr-component-0__toggle-btn')

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
