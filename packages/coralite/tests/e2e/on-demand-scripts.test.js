import { test, expect } from '@playwright/test'

test.describe('On-Demand Script Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/on-demand-scripts/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)
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
    await page.getByTestId('loadA').click()

    // Wait for on-demand-a to appear in DOM
    await expect(page.getByTestId('on-demand-a')).toBeVisible()

    // Check that on-demand-a script was loaded
    const scriptsAfterA = scriptRequests.filter(url => url.includes('on-demand-a'))
    expect(scriptsAfterA.length).toBeGreaterThan(0)

    // Check that on-demand-b is still NOT loaded
    const scriptsBAfterA = scriptRequests.filter(url => url.includes('on-demand-b'))
    expect(scriptsBAfterA.length).toBe(0)

    // Click Load B
    await page.getByTestId('loadB').click()

    // Wait for on-demand-b to appear in DOM
    await expect(page.getByTestId('on-demand-b')).toBeVisible()

    // Check that on-demand-b script was loaded
    const scriptsAfterB = scriptRequests.filter(url => url.includes('on-demand-b'))
    expect(scriptsAfterB.length).toBeGreaterThan(0)
  })
})
