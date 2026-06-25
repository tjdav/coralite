import { waitForHydration } from './helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Getter Token in Imperative Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/getter-token/')
    await waitForHydration(page)
  })

  test('should display getter value as token in imperative component', async ({ page }) => {
    const status = page.getByTestId(/getter-child-0__status/)
    await expect(status).toHaveText('Seen')
  })
})
