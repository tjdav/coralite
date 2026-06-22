import { test, expect } from '@playwright/test'

test.describe('Style Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/style-behavior/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)
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
})
