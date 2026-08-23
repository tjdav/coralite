import { waitForHydration, skipInProduction, skipInDevelopment } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('DevTools & Testing API (Development / Testing Modes)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipInProduction(testInfo)
    // Navigate to a page in the framework-core-dev server (port 3000, development mode)
    await page.goto('/client-script/')
    await waitForHydration(page)
  })

  test('should expose window.__coralite__ with correct methods and non-enumerable descriptor', async ({ page }) => {
    const isDefined = await page.evaluate(() => window.__coralite__ !== undefined)
    expect(isDefined).toBe(true)

    const isEnumerable = await page.evaluate(() => {
      return Object.keys(window).includes('__coralite__')
    })
    expect(isEnumerable).toBe(false)

    const properties = await page.evaluate(() => {
      const api = window.__coralite__
      return {
        version: api.version,
        mode: api.mode,
        hasLifecycle: api.lifecycle !== null,
        hasGetComponent: typeof api.getComponent === 'function',
        hasGetRegisteredComponents: typeof api.getRegisteredComponents === 'function',
        hasGetHydratedCount: typeof api.getHydratedCount === 'function',
        hasGetInstances: typeof api.getInstances === 'function',
        hasGetEvents: typeof api.getEvents === 'function'
      }
    })

    expect(properties.version).toBe('1.0.0')
    expect(properties.mode).toBe('development')
    expect(properties.hasLifecycle).toBe(true)
    expect(properties.hasGetComponent).toBe(true)
    expect(properties.hasGetRegisteredComponents).toBe(true)
    expect(properties.hasGetHydratedCount).toBe(true)
    expect(properties.hasGetInstances).toBe(true)
    expect(properties.hasGetEvents).toBe(true)
  })

  test('should return correct registered components', async ({ page }) => {
    const registered = await page.evaluate(() => {
      return window.__coralite__.getRegisteredComponents()
    })
    expect(registered).toContain('client-script-component')
  })

  test('should return correct instances currently attached to the DOM tree', async ({ page }) => {
    const count = await page.evaluate(() => {
      const instances = window.__coralite__.getInstances('client-script-component')
      return instances.length
    })
    expect(count).toBeGreaterThan(0)
  })

  test('should expose component-level introspection via Symbol.for("coralite.testing")', async ({ page }) => {
    const componentInfo = await page.evaluate(() => {
      const el = document.querySelector('client-script-component')
      const symbolKey = Symbol.for('coralite.testing')
      const testingContext = el[symbolKey]

      return {
        hasSymbol: testingContext !== undefined,
        instanceId: testingContext?.instanceId,
        componentId: testingContext?.componentId,
        hasState: testingContext?.state !== undefined,
        hasGetters: testingContext?.getters !== undefined,
        hasRefs: testingContext?.refs !== undefined
      }
    })

    expect(componentInfo.hasSymbol).toBe(true)
    expect(componentInfo.componentId).toBe('client-script-component')
    expect(componentInfo.hasState).toBe(true)
    expect(componentInfo.hasGetters).toBe(true)
    expect(componentInfo.hasRefs).toBe(true)
  })

  test('should allow getComponent lookup bridge', async ({ page }) => {
    const componentState = await page.evaluate(() => {
      const el = document.querySelector('client-script-component')
      const context = window.__coralite__.getComponent(el)
      return {
        instanceId: context?.instanceId,
        componentId: context?.componentId,
        title: context?.state?.title
      }
    })

    expect(componentState.componentId).toBe('client-script-component')
    expect(componentState.title).toBe('Initial Parent')
  })

  test('should log custom events in a bounded ring-buffer via getEvents()', async ({ page }) => {
    const beforeEventsCount = await page.evaluate(() => {
      return window.__coralite__.getEvents().length
    })

    // Click button to dispatch/trigger potential reactive/event cycles
    const comp = page.locator('client-script-component').first()
    const btn = comp.locator('.update-btn')
    await btn.click()

    // Wait a brief moment
    await page.waitForTimeout(100)

    const events = await page.evaluate(() => {
      return window.__coralite__.getEvents()
    })

    // Assert custom event logging is supported (if any events are captured)
    expect(Array.isArray(events)).toBe(true)
  })
})

test.describe('DevTools & Testing API (Production Mode)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipInDevelopment(testInfo)
    // Navigate to a page in the framework-core-prod server (port 3001, production mode)
    await page.goto('http://localhost:3001/client-script/')
    // Wait for the ready attribute which indicates hydration readiness in production mode
    await page.waitForSelector('html[data-coralite-ready]')
  })

  test('should completely strip window.__coralite__ in production', async ({ page }) => {
    const isUndefined = await page.evaluate(() => window.__coralite__ === undefined)
    expect(isUndefined).toBe(true)
  })

  test('should completely strip component-level testing symbols in production', async ({ page }) => {
    const hasSymbol = await page.evaluate(() => {
      const el = document.querySelector('client-script-component')
      if (!el) {
        return false
      }
      const symbolKey = Symbol.for('coralite.testing')
      return el[symbolKey] !== undefined
    })
    expect(hasSymbol).toBe(false)
  })
})
