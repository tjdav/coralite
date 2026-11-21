import { test, expect } from '../fixtures.js'
import { readFileSync } from 'node:fs'

const entries = JSON.parse(
  readFileSync(new URL('../../src/data/changelog.json', import.meta.url), 'utf8')
)

test('changelog renders every entry from data', async ({ page }) => {
  await page.goto('/changelog/')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.changelog-item')).toHaveCount(entries.length)

  const first = page.locator('.changelog-item').first()
  await expect(first).toHaveAttribute('id', entries[0].id)
  await expect(first.locator('.changelog-title')).toContainText(entries[0].title)
  await expect(first.locator('.changelog-badge')).toContainText(`${entries[0].package} v${entries[0].version}`)
})

test('changelog converts legacy markup into site components', async ({ page }) => {
  await page.goto('/changelog/')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('coralite-heading')).toHaveCount(0)
  await expect(page.locator('coralite-code-highlight')).toHaveCount(0)

  const headings = await page.locator('.changelog-body h3').evaluateAll(nodes => nodes.map(node => node.id))
  expect(headings.length).toBeGreaterThan(0)
  expect(headings.every(Boolean)).toBe(true)

  await expect(page.locator('.changelog-body code-block', { hasText: 'template' }).first()).toBeVisible()

  const summaries = await page.locator('.changelog-summary').allTextContents()
  expect(summaries.length).toBeGreaterThan(0)
  expect(summaries.every(text => !text.includes('`'))).toBe(true)
})

test('changelog code samples never inject raw elements', async ({ page }) => {
  await page.goto('/changelog/')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('.changelog-body script')).toHaveCount(0)
  await expect(page.locator('.changelog-body template')).toHaveCount(0)
  await expect(page.locator('.changelog-body code', { hasText: '<script' }).first()).toBeVisible()
})
