import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Static Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/static-components/')
    await waitForHydration(page)
  })

  test('should correctly render and bind attributes to template', async ({ page }) => {
    const comp = page.locator('static-component-a').first()

    const container = comp.getByTestId('static-container')
    await expect(container).toBeVisible()

    const title = comp.getByTestId('static-title')
    await expect(title).toHaveText('Hello World')

    const desc = comp.getByTestId('static-description')
    await expect(desc).toHaveText('This is static')
  })
})
