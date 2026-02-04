import { test, expect } from '@playwright/test'

test.describe('Computed Features', () => {
  test('should calculate computed tokens', async ({ page }) => {
    await page.goto('/reef.html')
    // Nemo should have 3 stripes
    const nemo = page.locator('.clown-fish').first()
    await expect(nemo.locator('h3')).toHaveText('Nemo')
    await expect(nemo.locator('p')).toHaveText('Stripes: 3')

    // Marlin should have 2 stripes (default/other logic)
    const marlin = page.locator('.clown-fish').nth(1)
    await expect(marlin.locator('h3')).toHaveText('Marlin')
    await expect(marlin.locator('p')).toHaveText('Stripes: 2')
  })

  test('should handle computed slots', async ({ page }) => {
    await page.goto('/migration.html')
    const school = page.locator('.school')
    // Should have 3 fish (cloned content)
    await expect(school.locator('div')).toHaveCount(3)
    await expect(school.locator('div').first()).toHaveText('Fishy')
  })

  test('should handle named slots and fallback', async ({ page }) => {
    await page.goto('/reef.html')
    const anemone = page.locator('.sea-anemone')

    // resident slot
    await expect(anemone.locator('.tentacles')).toContainText('Nemo and Marlin')

    // default slot fallback
    await expect(anemone.locator('.surroundings')).toContainText('Just water.')
  })
})
