import { test, expect } from '../fixtures.js'
import AxeBuilder from '@axe-core/playwright'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PAGES_DIR = fileURLToPath(new URL('../../src/pages', import.meta.url))
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

function collect (dir = PAGES_DIR, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue
      }
      collect(path, out)
    } else if (entry.name.endsWith('.html')) {
      out.push(path)
    }
  }
  return out
}

function routeFor (file) {
  const rel = file.slice(PAGES_DIR.length + 1).split('\\').join('/')
  if (rel === '404.html') {
    return '/404'
  }
  if (rel === 'index.html') {
    return '/'
  }
  if (rel.endsWith('/index.html')) {
    return `/${rel.slice(0, -'index.html'.length)}`
  }
  return `/${rel.slice(0, -'.html'.length)}/`
}

const ROUTES = collect().map(routeFor).sort()

test.skip(!process.env.A11Y_FULL, 'Set A11Y_FULL=1 to crawl every page')
for (const route of ROUTES) {
  test(`${route} has no automated violations`, async ({ page }) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    const details = results.violations
      .map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`)
      .join('\n')

    expect(results.violations, details).toEqual([])
  })
}
