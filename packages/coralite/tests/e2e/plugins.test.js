import { test, expect } from '@playwright/test'

test.describe('Plugins Extensibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    try {
      await page.evaluate(() => window.__coralite_ready__)
    } catch (e) {
      await page.waitForTimeout(500)
    }

  })

  test('should inject custom context and verify execution', async ({ page }) => {
    const pluginData = page.getByTestId('plugin-component__pluginData-0')
    const text = await pluginData.textContent()
    expect(text).toContain('Global: global-state-123')
    expect(text).toContain('Path: /plugins/')
    expect(text).toContain('Signal: true')
  })

  test('should verify metadata plugin mapping', async ({ page }) => {
    const metaInfo = page.getByTestId('meta-info')
    await expect(metaInfo).toHaveText('Title: Plugins Test Page')
  })
})
