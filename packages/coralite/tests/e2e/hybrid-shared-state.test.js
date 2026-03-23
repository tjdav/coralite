import { test, expect } from '@playwright/test'

test.describe('Hybrid Component System & Plugin Shared State', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to a test page containing the server-rendered <coral-reef>
    await page.goto('/hybrid-test-page.html')
  })

  test('should resolve the imperative component graph and mount it', async ({ page }) => {
    // Verify the declarative parent is present
    await expect(page.locator('h1')).toHaveText('Great Barrier Reef')

    // Verify the imperative child was successfully created and stamped into the DOM
    const anemone = page.locator('eco-sea-anemone')
    // Ensure it's rendered first (e.g. shadow dom initialized)
    await page.waitForFunction(() => {
      const anemone = document.querySelector('eco-sea-anemone')
      return anemone && anemone.shadowRoot && anemone.shadowRoot.querySelector('h3')
    }, { timeout: 10000 })

    // Use evaluate to access shadow DOM since Playwright doesn't pierce open shadow roots natively by default in all cases
    const headerText = await anemone.evaluate((node) => {
      const shadow = node.shadowRoot
      if (!shadow) return null
      return shadow.querySelector('h3').textContent
    })
    expect(headerText).toBe('Sea Anemone')
  })

  test('plugin helper should successfully share state across components', async ({ page }) => {
    // Because `ref="oceanTemp"` and `ref="warmBtn"` generate dynamic IDs,
    // we use robust semantic/text-based locators to find them.
    const reefTempDisplay = page.locator('p').filter({ hasText: 'Ocean Temp:' }).locator('span')

    // We need to wait for the button to be ready in the shadow DOM
    await page.waitForFunction(() => {
      const anemone = document.querySelector('eco-sea-anemone')
      return anemone && anemone.shadowRoot && anemone.shadowRoot.querySelector('button')
    }, { timeout: 10000 })

    // 1. Verify Parent read the initial metric state from the plugin helper
    await expect(reefTempDisplay).toHaveText('30')

    // 2. Click the button inside the Imperative Child
    // This triggers the plugin helper to update the global shared state (+5°C)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelector('eco-sea-anemone').shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Increase Global Temp'))
      btn.click()
    })

    // 3. Verify the Declarative Parent's DOM updated automatically
    // in response to the child's mutation of the shared plugin store
    await expect(reefTempDisplay).toHaveText('35')

    // Click again to ensure continuous reactivity
    await page.evaluate(() => {
      const btn = Array.from(document.querySelector('eco-sea-anemone').shadowRoot.querySelectorAll('button')).find(b => b.textContent.includes('Increase Global Temp'))
      btn.click()
    })
    await expect(reefTempDisplay).toHaveText('40')
  })
})
