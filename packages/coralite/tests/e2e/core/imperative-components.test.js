import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Imperative Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imperative-components/')
    await waitForHydration(page)
  })

  test('should create component imperatively and assign non-serializable objects', async ({ page }) => {
    const comp = page.locator('imperative-child').first()
    const title = comp.locator('h2')
    await expect(title).toHaveText('Imperative Mount')

    const dataDisplay = comp.locator('p')
    await expect(dataDisplay).toHaveText('A,B,C')
  })

  test('should prefix data-testid inside imperatively created child element', async ({ page }, testInfo) => {
    const isProduction = testInfo.project.name.includes('-prod')

    if (isProduction) {
      // In production, all data-testid attributes should be stripped
      await expect(page.locator('[data-testid]')).toHaveCount(0)
    } else {
      // In non-production, the child component should have its data-testid attributes prefixed with its instance ID.
      const childTitle = page.getByTestId(/imperative-child-\d+__title/)
      await expect(childTitle).toBeVisible()
      await expect(childTitle).toHaveText('Imperative Mount')

      const childDisplay = page.getByTestId(/imperative-child-\d+__dataDisplay/)
      await expect(childDisplay).toBeVisible()
      await expect(childDisplay).toHaveText('A,B,C')
    }
  })
})
