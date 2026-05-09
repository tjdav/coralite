import { test, expect } from '@playwright/test'

test.describe('Imperative Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imperative-components/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  test('should create component imperatively and assign non-serializable objects', async ({ page }) => {
    const title = page.getByTestId('imperative-child__title-0')
    await expect(title).toHaveText('Imperative Mount')

    const dataDisplay = page.getByTestId('imperative-child__dataDisplay-0')
    await expect(dataDisplay).toHaveText('Fetched data for 123')
  })
})
