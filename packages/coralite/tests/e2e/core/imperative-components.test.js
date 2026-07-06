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
})
