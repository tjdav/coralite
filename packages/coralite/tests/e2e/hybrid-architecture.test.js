import { test, expect } from '@playwright/test'

test.describe('Hybrid Architecture: The Coralite Ecosystem', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/aquarium.html')
    await page.waitForFunction(() => customElements.get('coral-reef') !== undefined)
    await page.waitForFunction(() => customElements.get('sea-anemone') !== undefined)
  })

  test('should render the declarative coral-reef and imperative sea-anemone', async ({ page }) => {
    await expect(page.locator('coral-reef')).toBeVisible()
    await expect(page.locator('sea-anemone')).toBeVisible()
  })

  test('should safely bind DOM refs across shadow boundaries', async ({ page }) => {
    const buttonText = await page.locator('sea-anemone').locator('#feed-btn').textContent()
    expect(buttonText.trim()).toBe('Feed Anemone')
  })

  test('should share a true Phase 1 singleton between parent and child', async ({ page }) => {
    const reefTemp = await page.locator('coral-reef').locator('#reef-temp').textContent()
    const anemoneTemp = await page.locator('sea-anemone').locator('#anemone-temp').textContent()

    expect(reefTemp).toBeTruthy()
    // The Holy Grail assertion: Phase 1 only ran once!
    expect(reefTemp).toBe(anemoneTemp)
  })

  test('should trigger DOM updates via the Web Component Reactivity Proxy', async ({ page }) => {
    const feedBtn = page.locator('sea-anemone').locator('#feed-btn')
    const tentacleDisplay = page.locator('sea-anemone').locator('#tentacle-count')

    // Check initial setup state
    expect(await tentacleDisplay.textContent()).toBe('10')

    // Trigger proxy mutations
    await feedBtn.click()
    await feedBtn.click()

    // Verify Proxy intercepted and ran this.updateDOM()
    expect(await tentacleDisplay.textContent()).toBe('20')
  })
})
