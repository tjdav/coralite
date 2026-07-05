import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Style Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-behavior/')
    await waitForHydration(page)
  })

  test('should have styles for declarative components', async ({ page }) => {
    // Check if style-parent has scoped style
    const parent = page.locator('style-parent > .parent-box')
    await expect(parent).toHaveCSS('border-top-style', 'solid')
    await expect(parent).toHaveCSS('border-top-width', '2px')

    // Check if style-child has scoped style
    const child = page.locator('style-child > .child-box').first()
    await expect(child).toHaveCSS('background-color', 'rgb(240, 240, 240)')

    // Check nested
    const nested = page.locator('style-nested > .nested-text').first()
    await expect(nested).toHaveCSS('color', 'rgb(0, 0, 255)')
  })

  test('should work for both declarative and imperative and append only one style/link', async ({ page }) => {
    const componentId = 'style-child'

    // In production it should be a link, in dev it should be a style tag
    // We'll check for both and ensure only one exists
    const getStyleCount = async () => {
      return await page.evaluate((cid) => {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
          .filter(l => l.href.includes(cid)).length
        const styles = Array.from(document.querySelectorAll('style'))
          .filter(s => s.textContent.includes(`data-style-selector="${cid}"`)).length
        return links + styles
      }, componentId)
    }

    const initialCount = await getStyleCount()
    expect(initialCount).toBe(1)

    // Add imperative instance
    await page.click('style-parent [ref$="__addBtn"]')

    // Wait for the new element to be added
    await expect(page.locator('style-child')).toHaveCount(2)

    // Verify it is actually rendered
    await expect(page.locator('style-child > .child-box').nth(1)).toBeVisible()

    const afterOneCount = await getStyleCount()
    expect(afterOneCount).toBe(1)

    // Add another imperative instance
    await page.click('style-parent [ref$="__addBtn"]')
    await expect(page.locator('style-child')).toHaveCount(3)
    await expect(page.locator('style-child > .child-box').nth(2)).toBeVisible()

    const afterTwoCount = await getStyleCount()
    expect(afterTwoCount).toBe(1)
  })

  test('should dynamically load CSS and render for imperative-only components', async ({ page }) => {
    const componentId = 'style-imperative-only'

    // Should not be present initially
    await expect(page.locator(componentId)).toHaveCount(0)

    // Add only imperative instance
    await page.click('style-parent [ref$="__addOnlyImperativeBtn"]')

    // Wait for the element to be added and upgraded
    await expect(page.locator(componentId)).toHaveCount(1)
    await expect(page.locator(`${componentId} > .imperative-only-box`)).toBeVisible()
    await expect(page.locator(`${componentId} > .imperative-only-box`)).toHaveCSS('color', 'rgb(0, 128, 0)')

    // Check style exists
    const styleCount = await page.evaluate((cid) => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(l => l.href.includes(cid)).length
      const styles = Array.from(document.querySelectorAll('style'))
        .filter(s => s.textContent.includes(`data-style-selector="${cid}"`)).length
      return links + styles
    }, componentId)
    expect(styleCount).toBe(1)
  })

  test('should not have styles for components without css', async ({ page }) => {
    const componentId = 'style-no-css'
    const styleCount = await page.evaluate((cid) => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(l => l.href.includes(cid)).length
      const styles = Array.from(document.querySelectorAll('style'))
        .filter(s => s.textContent.includes(`data-style-selector="${cid}"`)).length
      return links + styles
    }, componentId)

    expect(styleCount).toBe(0)
  })

  test('should have minified CSS and no source maps in production', async ({ page }) => {
    // Component CSS in production uses <link> tags with hashed filenames in assets/css/
    // In development, component CSS uses <style> tags.
    const isProduction = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .some(l => /style-child-.*\.css/.test(l.href))
    })

    if (!isProduction) {
      return
    }

    const cssLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => l.href)
        .filter(href => href.includes('assets/css/'))
    })

    for (const href of cssLinks) {
      const response = await page.request.get(href)
      const content = await response.text()

      // Better minification check: should not have more than 2 lines (some esbuild headers might add one)
      const lineCount = content.split('\n').length
      expect(lineCount).toBeLessThanOrEqual(2)

      // Check for no source maps
      expect(content).not.toContain('sourceMappingURL')

      // Check that the source map file does not exist
      const mapResponse = await page.request.get(href + '.map')
      expect(mapResponse.status()).toBe(404)
    }
  })

  test('should prevent FOUC by having styles in head', async ({ page }) => {
    const componentId = 'style-child'
    const isInHead = await page.evaluate((cid) => {
      const link = document.head.querySelector(`link[href*="${cid}"]`)
      const style = document.head.querySelector(`style`)
      // Check if style contains the selector if it's a style tag
      const hasStyle = style && style.textContent.includes(`data-style-selector="${cid}"`)
      return !!(link || hasStyle)
    }, componentId)

    expect(isInHead).toBe(true)
  })

  test('should have correct style ordering (global before component)', async ({ page }) => {
    const ordering = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      const globalIdx = elements.findIndex(el => el.tagName === 'LINK' && el.getAttribute('href')?.includes('styles.css'))
      const componentIdx = elements.findIndex(el => (el.tagName === 'LINK' && el.getAttribute('href')?.includes('style-child')) ||
        (el.tagName === 'STYLE' && el.textContent.includes('data-style-selector="style-child"'))
      )

      // If global styles exist, they should come before component styles
      if (globalIdx !== -1 && componentIdx !== -1) {
        return globalIdx < componentIdx
      }
      return true
    })

    expect(ordering).toBe(true)
  })

  test('should apply display: contents to imperative-only components', async ({ page }) => {
    const componentId = 'style-imperative-only'

    // Add imperative instance
    await page.click('style-parent [ref$="__addOnlyImperativeBtn"]')

    // Wait for the element to be added and upgraded
    await expect(page.locator(componentId)).toHaveCount(1)

    // Check if display: contents is applied
    const displayValue = await page.evaluate((cid) => {
      const el = document.querySelector(cid)
      return window.getComputedStyle(el).display
    }, componentId)

    expect(displayValue).toBe('contents')
  })
})
