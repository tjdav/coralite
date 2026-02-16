import { test, expect } from '@playwright/test'

test.describe('Component Styles', () => {
  test('should verify style system behavior', async ({ page }) => {
    await page.goto('/style-ocean')

    await test.step('Shared Styles (style-coral-reef)', async () => {
      const reefs = page.locator('.reef')
      await expect(reefs).toHaveCount(2)

      // Use toHaveCSS for cleaner assertions
      await expect(reefs.first()).toHaveCSS('color', 'rgb(255, 127, 80)')
      await expect(reefs.nth(1)).toHaveCSS('color', 'rgb(255, 127, 80)')

      // Use regex to match partial attribute values
      await expect(reefs.first()).toHaveAttribute('data-style-selector', /style-coral-reef/)
    })

    await test.step('Scoped Styles (style-sea-anemone)', async () => {
      const anemones = page.locator('.anemone')
      await expect(anemones).toHaveCount(2)
      await expect(anemones.first()).toHaveCSS('color', 'rgb(128, 0, 128)')

      // Verify UUID uniqueness
      const attr1 = await anemones.first().getAttribute('data-style-selector')
      const attr2 = await anemones.nth(1).getAttribute('data-style-selector')

      expect(attr1).not.toBe(attr2)
      expect(attr1).toContain('style-sea-anemone-')
    })

    await test.step('Mixed Styles and Head Injection', async () => {
      const mixed = page.locator('.mixed')
      // Regex matches: Contains shared name AND contains UUID pattern
      await expect(mixed).toHaveAttribute('data-style-selector', /(?=.*style-mixed-coral)(?=.*style-mixed-coral-)/)
      await expect(mixed).toHaveCSS('font-size', '16px')

      // Head check
      const styleTags = page.locator('head style')
      const allStyles = (await styleTags.allInnerTexts()).join('\n')
      expect(allStyles).toContain('[data-style-selector~="style-coral-reef"]')
    })
  })
})
