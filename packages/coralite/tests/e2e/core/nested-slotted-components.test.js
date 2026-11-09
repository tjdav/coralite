import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Nested Custom Elements in Slotted HTML', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nested-slotted-components/')
    await waitForHydration(page)
  })

  test('upgrades nested custom element in slotted HTML with non-zero dimensions and live click reactivity', async ({ page }) => {
    const isDefined = await page.evaluate(() => Boolean(customElements.get('nested-slotted-badge')))
    expect(isDefined).toBe(true)

    const badge = page.locator('#primary-badge')
    await expect(badge).toBeVisible()
    const box = await badge.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.width).toBeGreaterThan(0)
      expect(box.height).toBeGreaterThan(0)
    }

    const label = badge.locator('.badge-label')
    await expect(label).toHaveText('Primary Badge')

    const button = badge.locator('.badge-btn')
    await expect(button).toHaveText('Count: 0')

    await button.click()
    await expect(button).toHaveText('Count: 1')

    await button.click()
    await expect(button).toHaveText('Count: 2')
  })

  test('successfully resolves and hydrates custom elements deeply nested in multi-level HTML wrappers', async ({ page }) => {
    const deepBadge = page.locator('#deep-badge')
    await expect(deepBadge).toBeVisible()
    await expect(deepBadge.locator('.badge-label')).toHaveText('Deep Badge')

    const button = deepBadge.locator('.badge-btn')
    await expect(button).toHaveText('Count: 10')

    await button.click()
    await expect(button).toHaveText('Count: 11')
  })

  test('maintains independent hydration and state across sibling custom elements inside the same slot wrapper', async ({ page }) => {
    const badge1 = page.locator('#sibling-badge-1')
    const badge2 = page.locator('#sibling-badge-2')

    const btn1 = badge1.locator('.badge-btn')
    const btn2 = badge2.locator('.badge-btn')

    await expect(btn1).toHaveText('Count: 1')
    await expect(btn2).toHaveText('Count: 2')

    await btn1.click()
    await btn1.click()
    await expect(btn1).toHaveText('Count: 3')
    await expect(btn2).toHaveText('Count: 2')

    await btn2.click()
    await expect(btn2).toHaveText('Count: 3')
  })

  test('projects inner slots correctly when a component with slots is nested inside another component slot wrapper', async ({ page }) => {
    const panel = page.locator('#inner-panel')
    await expect(panel).toBeVisible()
    await expect(panel.locator('.panel-header')).toHaveText('Panel: Inner Controls')

    const slottedText = panel.locator('.panel-slotted-text')
    await expect(slottedText).toBeVisible()
    await expect(slottedText).toHaveText('Inner Slotted Text')
  })

  test('preserves no-hydration unwrapping on intermediate HTML wrappers without browser hydration', async ({ page }) => {
    const container = page.locator('#inert-test-container')

    const label = container.locator('.badge-label')
    await expect(label).toHaveText('Inert Static Badge')

    const button = container.locator('.badge-btn')
    await expect(button).toHaveText('Count: 50')

    const hasDataCid = await page.evaluate(() => {
      const el = document.querySelector('#inert-test-container .badge-wrapper')
      return el ? el.hasAttribute('data-cid') : false
    })
    expect(hasDataCid).toBe(false)

    await button.click()
    await expect(button).toHaveText('Count: 50')
  })
})
