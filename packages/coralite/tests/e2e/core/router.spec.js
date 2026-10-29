import { test, expect } from '@playwright/test'

test.describe('SPA Router', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => window.__shellHydrated__ === true)
  })

  test('navigates without full page reload and preserves client state', async ({ page }) => {
    await page.click('#increment')
    await expect(page.locator('#counter-display')).toHaveText('1')

    await page.click('#link-about')

    await expect(page).toHaveURL('/about')
    await expect(page.locator('#page-title')).toHaveText('About Page')

    await expect(page.locator('#counter-display')).toHaveText('1')

    const isHydrated = await page.evaluate(() => window.__shellHydrated__)
    expect(isHydrated).toBe(true)
  })

  test('routes are intercepted and guards redirect', async ({ page }) => {
    await page.click('#link-admin')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('#page-title')).toHaveText('About Page')
  })

  test('external links bypass the router', async ({ page }) => {
    const navigationPromise = page.waitForNavigation({ url: 'https://example.com/' })
    await page.click('#link-external')
    await navigationPromise
  })

  test('fires navigating and navigated events', async ({ page }) => {
    await page.evaluate(() => {
      window.__navEvents = []
      window.addEventListener('coralite:navigating', (e) => window.__navEvents.push(`navigating:${e.detail.to}`))
      window.addEventListener('coralite:navigated', (e) => window.__navEvents.push(`navigated:${e.detail.to}`))
    })

    await page.click('#link-about')
    await expect(page).toHaveURL('/about')

    const events = await page.evaluate(() => window.__navEvents)
    expect(events).toContain('navigating:/about')
    expect(events).toContain('navigated:/about')
  })

  test('router navigation triggers startViewTransition when enabled', async ({ page }) => {
    await page.evaluate(() => {
      window.__coralite_hydration__ = window.__coralite_hydration__ || {}
      window.__coralite_hydration__.viewTransitions = true
      window.__vtCallCount = 0
      document.startViewTransition = (cb) => {
        window.__vtCallCount++
        const res = cb ? cb() : null
        return { finished: Promise.resolve(res) }
      }
    })

    await page.click('#link-about')
    await expect(page).toHaveURL('/about')

    const count = await page.evaluate(() => window.__vtCallCount)
    expect(count).toBe(1)
  })

  test('navigation succeeds when startViewTransition unavailable', async ({ page }) => {
    await page.evaluate(() => {
      window.__coralite_hydration__ = window.__coralite_hydration__ || {}
      window.__coralite_hydration__.viewTransitions = true
      Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        value: undefined
      })
      window.__navigatedFired = false
      window.addEventListener('coralite:navigated', () => {
        window.__navigatedFired = true
      })
    })

    await page.click('#link-about')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('#page-title')).toHaveText('About Page')

    const navigatedFired = await page.evaluate(() => window.__navigatedFired)
    expect(navigatedFired).toBe(true)
  })

  test('navigation falls back to sync when startViewTransition throws', async ({ page }) => {
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.evaluate(() => {
      window.__coralite_hydration__ = window.__coralite_hydration__ || {}
      window.__coralite_hydration__.viewTransitions = true
      document.startViewTransition = () => {
        throw new Error('mock failure')
      }
    })

    await page.click('#link-about')
    await expect(page).toHaveURL('/about')
    await expect(page.locator('#page-title')).toHaveText('About Page')

    expect(consoleErrors).toEqual([])
  })
})
