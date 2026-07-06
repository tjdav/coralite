import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Getter Token in Imperative Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/getter-token/')
    await waitForHydration(page)
  })

  test('should display getter value as token in imperative component', async ({ page }) => {
    const comp = page.locator('getter-child').first()
    const status = comp.locator('p')
    await expect(status).toHaveText('Seen')
  })
})
