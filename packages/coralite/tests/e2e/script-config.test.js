import { test, expect } from '@playwright/test'

test.describe('Script Plugin Configuration', () => {
  // Files are created as fixtures before the test run to ensure they are included in the build

  test('should inject config and imports into script helpers', async ({ page }) => {
    await page.goto('/script-test.html')

    // Check if the component rendered
    // The component replaces itself with the template content <div id="target">
    const target = page.locator('#target')

    await expect(target).toHaveText('Hello from config - foo', { timeout: 5000 })
    await expect(target).toHaveAttribute('data-updated', 'true')
  })
})
