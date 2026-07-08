import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Plugins Extensibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/')
    await waitForHydration(page)
  })

  test('should inject custom context and verify execution', async ({ page }) => {
    const comp = page.locator('plugin-component').first()
    const pluginData = comp.locator('.plugin-data-display')
    await expect(pluginData).toContainText('Global: global-state-123')
    await expect(pluginData).toContainText('InstanceId: plugin-component-0')
    await expect(pluginData).toContainText('Signal: true')
  })

  test('should verify metadata plugin mapping', async ({ page }) => {
    const comp = page.locator('plugin-component').first()
    const metaInfo = comp.locator('.meta-info-display')
    await expect(metaInfo).toHaveText('Title: Plugins Test Page')
  })

  test('should verify server-side plugin export execution', async ({ page }) => {
    const comp = page.locator('plugin-component').first()
    const pluginMessage = comp.locator('.plugin-message-display')
    await expect(pluginMessage).toHaveText('Hello E2E Test from server-side plugin! Page: /plugins/index.html')
  })

  test('should verify client-side hooks execution', async ({ page }) => {
    const comp = page.locator('plugin-component').first()
    const beforeHook = comp.locator('.hook-message-display')
    await expect(beforeHook).toHaveText('Before Render Hook Worked!')

    const afterHook = comp.locator('.hook-result-display')
    await expect(afterHook).toHaveText('After Render Hook Worked!')
  })

  test('should dynamically render child and load dynamic import from plugin context', async ({ page }) => {
    await page.goto('/plugins/dynamic-plugin/')

    const child = page.locator('plugin-injected-child').last()
    // We expect it to be present in the DOM
    await expect(child).toHaveCount(1)

    // Check that the dynamic module was executed and text assigned
    await expect(child).toHaveText('Msg: Dynamic Module Loaded!')
  })
})
