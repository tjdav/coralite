import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Slots Projection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slots-projection/')
    await waitForHydration(page)
  })

  test('should render fallback content when slot is empty', async ({ page }) => {
    const fallbackTest = page.locator('#fallback-test')
    await expect(fallbackTest).toContainText('Fallback Content')
  })

  test('should transform slot content if transformation returns string', async ({ page }) => {
    const transformTest = page.locator('#transform-test')
    await expect(transformTest).toContainText('Transformed: Transform Me')
  })

  test('should preserve original nodes and state when transformation returns void', async ({ page }) => {
    const preserveTest = page.locator('#preserve-test')
    const btn = preserveTest.locator('button')

    await expect(btn).toHaveText('Unchanged')
    await btn.click()
    await expect(btn).toHaveText('Clicked')
  })
})
