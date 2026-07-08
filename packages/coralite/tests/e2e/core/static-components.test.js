import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Static Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/static-components/')
    await waitForHydration(page)
  })

  test('should correctly render and bind attributes to template', async ({ page }, testInfo) => {
    // Check if the component rendered
    const comp = page.locator('static-component-a').first()

    const isProduction = testInfo.project.name.includes('-prod')

    if (isProduction) {
      await expect(page.locator('[data-testid]')).toHaveCount(0)
      const container = comp.locator('.static-container')
      await expect(container).toBeVisible()
      await expect(comp.locator('.static-title')).toHaveText('Hello World')
      await expect(comp.locator('.static-description')).toHaveText('This is static')
    } else {
      const container = page.getByTestId(/static-component-a-\d+__static-container/)
      await expect(container).toBeVisible()

      // Check data binding
      const title = page.getByTestId(/static-component-a-\d+__static-title/)
      await expect(title).toHaveText('Hello World')

      const desc = page.getByTestId(/static-component-a-\d+__static-description/)
      await expect(desc).toHaveText('This is static')
    }
  })
})
