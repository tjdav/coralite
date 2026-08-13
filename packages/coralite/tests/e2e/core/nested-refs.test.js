import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Nested Refs through Foreign Custom Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nested-refs/')
    await waitForHydration(page)
  })

  test('resolves refs nested in light-DOM child custom elements and keeps them live', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    const container = page.locator('#nested-ref-test')
    const status = container.locator('.theme-status')
    const toggle = container.locator('.toggle-btn')
    const themeBtn = container.locator('.theme-btn')

    // Initial SSR / reactive render
    await expect(status).toHaveText('Light')

    // Independent control: top-level ref is live -> component hydrated
    await toggle.click()             // Light -> Dark
    await expect(status).toHaveText('Dark')

    // THE regression: deep ref must be live. Pre-fix refs('btnChangeTheme') was null,
    // so no listener was attached (or client() threw).
    await toggle.click()             // Dark -> Light
    await themeBtn.click()           // Light -> Dark, only if the deep listener exists
    await expect(status).toHaveText('Dark')

    // The resolved deep ref received the framework-unique ref attribute
    await expect(themeBtn).toHaveAttribute('ref', /nested-ref-parent-\d+__btnChangeTheme/)

    // No unhandled exceptions (e.g. reading addEventListener of null)
    expect(pageErrors).toEqual([])
  })
})
