import { test, expect } from '../fixtures.js'

test('the diagnostics reference lists every catalogue code', async ({ page }) => {
  await page.goto('/reference/diagnostics/')
  await page.waitForLoadState('networkidle')

  const rows = page.locator('[data-diagnostics-row]')
  await expect(rows).toHaveCount(52)

  await expect(page.locator('.diag-stat').first()).toContainText('52')
  await expect(page.locator('[data-diagnostics-count]')).toHaveText('52 of 52 codes shown')

  await expect(page.locator('#coralite-e201')).toContainText('Complex template expression')
  await expect(page.locator('#coralite-e201')).toContainText('auto-fix')
})

test('the catalogue filters by search, family and fixability', async ({ page }) => {
  await page.goto('/reference/diagnostics/')
  await page.waitForLoadState('networkidle')

  const visible = page.locator('[data-diagnostics-row]:not(.is-hidden)')

  await page.fill('[data-diagnostics-search]', 'template')
  await expect(page.locator('[data-diagnostics-count]')).toContainText('of 52 codes shown')
  expect(await visible.count()).toBeLessThan(52)

  await page.fill('[data-diagnostics-search]', '')
  await page.selectOption('[data-diagnostics-family]', 'config')
  await expect(visible).toHaveCount(3)

  await page.selectOption('[data-diagnostics-family]', '')
  await page.check('[data-diagnostics-fixable]')
  await expect(visible).toHaveCount(12)

  await page.fill('[data-diagnostics-search]', 'zzzz-not-a-code')
  await expect(page.locator('[data-diagnostics-empty]')).toBeVisible()
  await expect(page.locator('[data-diagnostics-count]')).toHaveText('0 of 52 codes shown')
})

test('catalogue anchors resolve to their row', async ({ page }) => {
  await page.goto('/reference/diagnostics/#coralite-p211')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('#coralite-p211')).toBeVisible()
  await expect(page.locator('#coralite-p211')).toContainText('Mixed context declarations')
})
