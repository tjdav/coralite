import { test, expect } from '../fixtures.js'

/**
 * Asserts that an element is fully inside the viewport.
 * @param {import('@playwright/test').Page} page - Page under test.
 * @param {string} selector - Element selector.
 * @param {number} fold - Viewport height in CSS pixels.
 * @returns {Promise<void>} Resolves when the element is above the fold.
 */
async function expectAboveFold (page, selector, fold) {
  const box = await page.locator(selector).boundingBox()
  expect(box, selector).not.toBeNull()
  expect(box.y + box.height, `${selector} bottom`).toBeLessThanOrEqual(fold)
}

test.describe('hero on a 360x640 phone', () => {
  test.use({
    viewport: {
      width: 360,
      height: 640
    }
  })

  test('keeps both CTAs and the install command above the fold', async ({ page }) => {
    await page.goto('/')
    await expectAboveFold(page, '.hero-actions', 640)
    await expectAboveFold(page, '.hero-content code-block', 640)
  })
})

test.describe('hero on a 320x568 phone', () => {
  test.use({
    viewport: {
      width: 320,
      height: 568
    }
  })

  test('keeps the primary CTAs above the fold and inside the viewport', async ({ page }) => {
    await page.goto('/')
    await expectAboveFold(page, '.hero-actions', 568)
    const box = await page.locator('.hero-actions').boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
  })
})
