import { test, expect } from '@playwright/test'

test.describe('Components', () => {
  test('should render basic component', async ({ page }) => {
    await page.goto('/reef.html')
    await expect(page.locator('.reef')).toBeVisible()
    await expect(page.locator('.reef h1')).toHaveText('Great Barrier Reef')
  })

  test('should pass attributes to component', async ({ page }) => {
    await page.goto('/abyss.html')
    const deepSea = page.locator('.deep-sea')
    await expect(deepSea).toHaveAttribute('data-depth', '2000')
    await expect(deepSea).toContainText('Creature: Anglerfish')
  })
})
