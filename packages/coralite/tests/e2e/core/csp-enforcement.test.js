import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Content Security Policy Enforcement', () => {
  test('page with CSP loads without console CSP errors and hydrates components', async ({ page }) => {
    const cspErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspErrors.push(msg.text())
      }
    })

    await page.goto('/client-script/')
    await waitForHydration(page)

    expect(cspErrors).toHaveLength(0)

    const isReady = await page.getAttribute('html', 'data-coralite-ready')
    expect(isReady).toBe('true')
  })
})
