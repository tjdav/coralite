import { test, expect } from '@playwright/test'

test.describe('Plugins Extensibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should inject custom context and verify execution', async ({ page }) => {
    const pluginData = page.getByTestId('plugin-component-0__pluginData')
    await expect(pluginData).toContainText('Global: global-state-123')
    await expect(pluginData).toContainText('InstanceId: plugin-component-0')
    await expect(pluginData).toContainText('Signal: true')
  })

  test('should verify metadata plugin mapping', async ({ page }) => {
    const metaInfo = page.getByTestId('plugin-component-0__meta-info')
    await expect(metaInfo).toHaveText('Title: Plugins Test Page')
  })

  test('should verify server-side plugin export execution', async ({ page }) => {
    const pluginMessage = page.getByTestId('plugin-component-0__plugin-message')
    await expect(pluginMessage).toHaveText('Hello E2E Test from server-side plugin! Page: /plugins/index.html')
  })

  test('should dynamically render child and load dynamic import from plugin context', async ({ page }) => {
    await page.goto('/plugins/dynamic-plugin/')

    const child = page.locator('plugin-injected-child')
    await expect(child).toBeVisible()

    // Check that the dynamic module was executed and text assigned
    await expect(child).toHaveText('Dynamic Module Loaded!')
  })
})
