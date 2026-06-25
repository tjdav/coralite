import { waitForHydration } from './helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Static Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/static-components/')
    await waitForHydration(page)
  })

  test('should correctly render and bind attributes to template', async ({ page }) => {
    // Check if the component rendered
    const container = page.getByTestId('static-component-a-0__static-container')
    await expect(container).toBeVisible()

    // Check data binding
    const title = page.getByTestId('static-component-a-0__static-title')
    await expect(title).toHaveText('Hello World')

    const desc = page.getByTestId('static-component-a-0__static-description')
    await expect(desc).toHaveText('This is static')
  })
})
