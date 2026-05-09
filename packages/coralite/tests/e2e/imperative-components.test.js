import { test, expect } from '@playwright/test'

test.describe('Imperative Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imperative-components/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    try {
      await page.evaluate(() => window.__coralite_ready__)
    } catch (e) {
      await page.waitForTimeout(500)
    }

  })

  test('should create component imperatively and assign non-serializable objects', async ({ page }) => {
    const host = page.getByTestId('imperative-child-host')

    const title = host.locator('h2')
    await expect(title).toHaveText('Imperative Mount')

    const dataDisplay = host.locator('p')
    await expect(dataDisplay).toHaveText('A,B,C')
  })
})
