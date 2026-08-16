import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Content Security Policy Enforcement', () => {
  test('page with CSP loads without console CSP errors, delivers CSP meta, and hydrates components', async ({ page }) => {
    const cspErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspErrors.push(msg.text())
      }
    })

    await page.goto('/csp-test/')
    await waitForHydration(page)

    expect(cspErrors).toHaveLength(0)

    const isReady = await page.getAttribute('html', 'data-coralite-ready')
    expect(isReady).toBe('true')

    const metaContent = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content')
    expect(metaContent).not.toBeNull()
    expect(metaContent).toContain("script-src 'self'")
    expect(metaContent).toContain('sha256-')
  })
})
