import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Plugins - Basic Extensibility', () => {
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

  test('should support the observe pattern via plugins', async ({ page }) => {
    const comp = page.locator('plugin-component').first()
    const observeDisplay = comp.locator('.plugin-observe-display')
    const mutateBtn = comp.locator('.mutate-btn')

    await expect(observeDisplay).toHaveText('No Mutation')

    await mutateBtn.click()

    await expect(observeDisplay).toHaveText('Plugin Observed: 10')
  })
})

test.describe('Plugins - Advanced Features', () => {
  test('Plugin Service Registry: should verify server-side and client-side resolution', async ({ page }) => {
    await page.goto('/plugins/registry-test/')
    await waitForHydration(page)

    const comp = page.locator('registry-test-component').first()

    // SSR
    const serverResult = comp.locator('p').nth(1)
    await expect(serverResult).toHaveText('Server Data from DB')

    // Interactivity
    const clientResult = comp.locator('p').nth(2)
    const actionButton = comp.locator('button')

    await expect(clientResult).toHaveText('Initial Client State')
    await actionButton.click()
    await expect(clientResult).toHaveText('Client Action Performed')
  })

  test('Plugin State Mutation: should verify global context mutation propagation', async ({ page }) => {
    await page.goto('/plugins/mutation-test/')
    await waitForHydration(page)

    const comp = page.locator('mutation-test-component').first()

    const serverResult = comp.locator('p').first()
    await expect(serverResult).toHaveText('Server Data from DB')

    const clientResult = comp.locator('p').last()
    const actionButton = comp.locator('button')

    await expect(clientResult).toHaveText('Initial Client State')
    await actionButton.click()
    await expect(clientResult).toHaveText('Client Action Performed')
  })
})

test.describe('Plugins - Config Types', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plugins/config-types/')
    await waitForHydration(page)
  })

  test('should correctly serialize and deserialize non-JSON types in plugin config', async ({ page }) => {
    const comp = page.locator('config-types-component').first()
    await expect(comp.locator('div > div').nth(0)).toHaveText('is-regex')
    await expect(comp.locator('div > div').nth(1)).toHaveText('is-date')
    await expect(comp.locator('div > div').nth(2)).toHaveText('3')
    await expect(comp.locator('div > div').nth(3)).toHaveText('value')
    await expect(comp.locator('div > div').nth(4)).toHaveText('true')
  })
})
