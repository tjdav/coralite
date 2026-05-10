import { test, expect } from '@playwright/test'

test.describe('Static Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/static-components/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should correctly render and bind attributes to template', async ({ page }) => {
    // Check if the component rendered
    const container = page.getByTestId('static-container')
    await expect(container).toBeVisible()

    // Check data binding
    const title = page.getByTestId('static-title')
    await expect(title).toHaveText('Hello World')

    const desc = page.getByTestId('static-desc')
    await expect(desc).toHaveText('This is static')
  })
})
