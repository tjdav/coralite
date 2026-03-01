import { test, expect } from '@playwright/test'

test.describe('Client and Plugin Imports', () => {
  test('Component client imports should load local JS, local JSON, and remote ESM module', async ({ page }) => {
    await page.goto('/imports-component-page.html')

    const localJs = page.locator('#local-js')
    await expect(localJs).toHaveText('Local JS: foo')

    const localJson = page.locator('#local-json')
    await expect(localJson).toHaveText('Local JSON: Coralite E2E v1.0.0')

    const remoteBtn = page.locator('#remote-btn')
    await remoteBtn.click()
    await expect(remoteBtn).toHaveAttribute('data-triggered', 'true')

    const dynamicBtn = page.locator('#dynamic-btn')
    await dynamicBtn.click()
    await expect(dynamicBtn).toHaveAttribute('data-triggered', 'true')
  })

  test('Plugin scripts should inject local JS, local JSON, and remote ESM module correctly', async ({ page }) => {
    await page.goto('/imports-plugin-page.html')

    const pluginResults = page.locator('#plugin-results')
    await expect(pluginResults).toHaveText('Plugin JS: bar, Plugin JSON: Coralite E2E')
    await expect(pluginResults).toHaveAttribute('data-confetti-loaded', 'true')

    const pluginRemoteBtn = page.locator('#plugin-remote-btn')
    await pluginRemoteBtn.click()
    await expect(pluginRemoteBtn).toHaveAttribute('data-triggered', 'true')
  })
})
