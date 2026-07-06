import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('On-Demand Script Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/on-demand-scripts/')
    await waitForHydration(page)
  })

  test('should load imperative components only when requested', async ({ page }) => {
    // Collect all script requests
    const scriptRequests = []
    page.on('request', request => {
      if (request.resourceType() === 'script') {
        scriptRequests.push(request.url())
      }
    })

    // Check that on-demand-a and on-demand-b are NOT loaded initially
    const initialScripts = scriptRequests.filter(url => url.includes('on-demand-a') || url.includes('on-demand-b'))
    expect(initialScripts.length).toBe(0)

    // Click Load A
    const parent = page.locator('on-demand-parent').first()
    await parent.locator('button').first().click()

    // Wait for on-demand-a to appear in DOM
    const compA = page.locator('on-demand-a').first()
    await expect(compA.locator('div')).toBeVisible()

    // Check that on-demand-a script was loaded
    const scriptsAfterA = scriptRequests.filter(url => url.includes('on-demand-a'))
    expect(scriptsAfterA.length).toBeGreaterThan(0)

    // Check that on-demand-b is still NOT loaded
    const scriptsBAfterA = scriptRequests.filter(url => url.includes('on-demand-b'))
    expect(scriptsBAfterA.length).toBe(0)

    // Click Load B
    await parent.locator('button').nth(1).click()

    // Wait for on-demand-b to appear in DOM
    const compB = page.locator('on-demand-b').first()
    await expect(compB.locator('div')).toBeVisible()

    // Check that on-demand-b script was loaded
    const scriptsAfterB = scriptRequests.filter(url => url.includes('on-demand-b'))
    expect(scriptsAfterB.length).toBeGreaterThan(0)
  })
})
