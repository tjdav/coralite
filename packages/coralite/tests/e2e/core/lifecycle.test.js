import { waitForHydration, skipInProduction } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Granular Lifecycle', () => {
  test.beforeEach(({}, testInfo) => {
    skipInProduction(testInfo)
  })

  test('should provide awaitable defined, rendered, and hydrated phases', async ({ page }) => {
    await page.goto('/client-script/')

    await page.waitForFunction(() => window.__coralite__.lifecycle !== undefined)

    const phases = await page.evaluate(async () => {
      const results = {}
      await window.__coralite__.lifecycle.defined.then(() => {
        results.defined = true
      })
      await window.__coralite__.lifecycle.rendered.then(() => {
        results.rendered = true
      })
      await window.__coralite__.lifecycle.hydrated.then(() => {
        results.hydrated = true
      })
      return results
    })

    expect(phases.defined).toBe(true)
    expect(phases.rendered).toBe(true)
    expect(phases.hydrated).toBe(true)
  })

  test('should support waitFor(element) for imperative components and correctly track inlined/dynamic styles', async ({ page }) => {
    await page.goto('/style-behavior/')
    await waitForHydration(page)

    const result = await page.evaluate(async () => {
      const parent = document.querySelector('style-parent')
      const btn = parent.querySelector('.add-only-imperative-btn')

      btn.click()

      // The component is added asynchronously by the click listener in style-parent
      // We need to find it.
      const findChild = () => document.querySelector('style-imperative-only')
      let child = findChild()
      while (!child) {
        await new Promise(r => setTimeout(r, 10))
        child = findChild()
      }

      await window.__coralite__.lifecycle.waitFor(child)

      const isLoadedInSet = window.__coralite_styles_loaded__ ? window.__coralite_styles_loaded__.has('style-imperative-only') : false
      const isLoadedInDevTools = window.__coralite__ && window.__coralite__.stylesLoaded ? window.__coralite__.stylesLoaded.includes('style-imperative-only') : false

      return {
        ready: true,
        isLoadedInSet,
        isLoadedInDevTools
      }
    })

    expect(result.ready).toBe(true)
    await expect(page.locator('style-imperative-only .imperative-only-box')).toHaveCSS('color', 'rgb(0, 128, 0)')
    expect(result.isLoadedInSet).toBe(true)
    expect(result.isLoadedInDevTools).toBe(true)
  })

  test('waitFor(element) should resolve immediately if component is already ready', async ({ page }) => {
    await page.goto('/client-script/')
    await waitForHydration(page)

    const result = await page.evaluate(async () => {
      const el = document.querySelector('client-script-component')
      const start = performance.now()
      await window.__coralite__.lifecycle.waitFor(el)
      return performance.now() - start
    })

    // Should be near 0ms
    expect(result).toBeLessThan(50)
  })
})
