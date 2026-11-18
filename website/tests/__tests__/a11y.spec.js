import { test, expect } from '../fixtures.js'
import AxeBuilder from '@axe-core/playwright'

const ROUTES = [
  '/',
  '/why/',
  '/compare/',
  '/docs/',
  '/docs/guide/getting-started/',
  '/reference/',
  '/reference/client/',
  '/learn/',
  '/learn/01-the-document/',
  '/blog/',
  '/blog/coralite-v0-43-1/',
  '/changelog/',
  '/legal/',
  '/privacy/'
]

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const report = (violations) => violations
  .map((violation) => {
    const targets = violation.nodes.map((node) => `  ${node.target.join(' ')}`).join('\n')
    return `${violation.id} (${violation.impact}): ${violation.help}\n${targets}`
  })
  .join('\n\n')

const audit = async (page) => {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(results.violations, report(results.violations)).toEqual([])
}

test.describe('WCAG 2.2 AA', () => {
  for (const route of ROUTES) {
    test(`${route} has no automated violations`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await audit(page)
    })
  }

  test('mobile home has no automated violations', async ({ page }) => {
    await page.setViewportSize({
      width: 390,
      height: 844
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await audit(page)
  })

  test('mobile lesson has no automated violations', async ({ page }) => {
    await page.setViewportSize({
      width: 390,
      height: 844
    })
    await page.goto('/learn/01-the-document/')
    await page.waitForLoadState('networkidle')
    await audit(page)
  })
})
