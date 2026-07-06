import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Static Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/static-components/')
    await waitForHydration(page)
  })

  test('should correctly render and bind attributes to template', async ({ page }) => {
    // Check if the component rendered
    const comp = page.locator('static-component-a').first()
    const container = comp.locator('div')
    await expect(container).toBeVisible()

    // Check data binding
    const title = comp.locator('h2')
    await expect(title).toHaveText('Hello World')

    const desc = comp.locator('p')
    await expect(desc).toHaveText('This is static')
  })
})
