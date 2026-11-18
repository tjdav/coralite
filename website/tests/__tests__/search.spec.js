import { test, expect } from '../fixtures.js'

test('command palette searches the site index and navigates', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const overlay = page.locator('.cp-overlay')

  await expect(async () => {
    await page.keyboard.press('Control+k')
    await expect(overlay).toHaveClass(/is-open/, { timeout: 1000 })
  }).toPass({ timeout: 10000 })

  const input = page.locator('.cp-input')
  await expect(input).toBeFocused()

  await input.fill('reactivity')
  await expect(page.locator('.cp-item').first()).toContainText('Reactivity')

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/docs\/concepts\/reactivity$/)
})

test('command palette finds release notes', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(async () => {
    await page.keyboard.press('Control+k')
    await expect(page.locator('.cp-overlay')).toHaveClass(/is-open/, { timeout: 1000 })
  }).toPass({ timeout: 10000 })

  await page.locator('.cp-input').fill('imperative element prefixing')
  await expect(page.locator('.cp-item').first()).toContainText('v0.43.1', { timeout: 10000 })
})
