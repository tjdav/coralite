import { test, expect } from '@playwright/test'

test.describe('Granular Lifecycle', () => {
  test('should provide awaitable defined, rendered, and hydrated phases', async ({ page }) => {
    await page.goto('/client-script/')

    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)

    const phases = await page.evaluate(async () => {
      const results = {}
      await window.__coralite_ready__.defined.then(() => {
        results.defined = true
      })
      await window.__coralite_ready__.rendered.then(() => {
        results.rendered = true
      })
      await window.__coralite_ready__.hydrated.then(() => {
        results.hydrated = true
      })
      return results
    })

    expect(phases.defined).toBe(true)
    expect(phases.rendered).toBe(true)
    expect(phases.hydrated).toBe(true)
  })

  test('should support waitFor(element) for imperative components', async ({ page }) => {
    await page.goto('/style-behavior/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__.hydrated)

    const result = await page.evaluate(async () => {
      const parent = document.querySelector('style-parent')
      const btn = parent.querySelector('[ref$="addOnlyImperativeBtn"]')

      btn.click()

      // The component is added asynchronously by the click listener in style-parent
      // We need to find it.
      const findChild = () => document.querySelector('style-imperative-only')
      let child = findChild()
      while (!child) {
        await new Promise(r => setTimeout(r, 10))
        child = findChild()
      }

      await window.__coralite_ready__.waitFor(child)
      return true
    })

    expect(result).toBe(true)
  })

  test('waitFor(element) should resolve immediately if component is already ready', async ({ page }) => {
    await page.goto('/client-script/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__.hydrated)

    const result = await page.evaluate(async () => {
      const el = document.querySelector('client-script-component')
      const start = performance.now()
      await window.__coralite_ready__.waitFor(el)
      return performance.now() - start
    })

    // Should be near 0ms
    expect(result).toBeLessThan(50)
  })
})
