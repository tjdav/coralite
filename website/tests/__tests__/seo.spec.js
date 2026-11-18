import { test, expect } from '../fixtures.js'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PAGES_DIR = fileURLToPath(new URL('../../src/pages', import.meta.url))
const ORIGIN = 'https://coralite.dev'

function collectPages (dir = PAGES_DIR, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue
      }
      collectPages(path, out)
    } else if (entry.name.endsWith('.html')) {
      out.push(path)
    }
  }
  return out
}

function metaBlock (source, file) {
  const match = source.match(/<page-meta[\s\S]*?<\/page-meta>/)
  expect(match, `${file} is missing <page-meta>`).toBeTruthy()
  return match[0]
}

function attribute (block, name) {
  const match = block.match(new RegExp(`\\n\\s*${name}="([^"]*)"`))
  return match ? match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : undefined
}

test.describe('page metadata', () => {
  test('home page exposes the full metadata set', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveTitle("Coralite — Grow your app. Don't rewrite it.")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/`)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${ORIGIN}/`)
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website')
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'Coralite')
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${ORIGIN}/images/social.png`)
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/)
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1)
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1)
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2)
    await expect(page.locator('page-meta')).toHaveCount(0)
  })

  test('content pages keep their documented title format', async ({ page }) => {
    await page.goto('/docs/guide/getting-started')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveTitle('Getting Started — Coralite Docs')
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Getting Started — Coralite Docs')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/docs/guide/getting-started`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /install Coralite/)
    await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(0)
  })

  test('section hubs canonicalise to their trailing-slash URLs', async ({ page }) => {
    const hubs = [
      ['/docs/', `${ORIGIN}/docs/`],
      ['/learn/', `${ORIGIN}/learn/`],
      ['/reference/', `${ORIGIN}/reference/`],
      ['/blog/', `${ORIGIN}/blog/`],
      ['/changelog/', `${ORIGIN}/changelog/`]
    ]

    for (const [url, canonical] of hubs) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical)
    }
  })

  test('blog posts declare article metadata', async ({ page }) => {
    await page.goto('/blog/coralite-v0-43-1')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
    await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute('content', '2026-07-10')
    await expect(page.locator('meta[property="article:author"]')).toHaveAttribute('content', 'Thomas David')
    await expect(page.locator('meta[name="published_time"]')).toHaveAttribute('content', '2026-07-10')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}/blog/coralite-v0-43-1`)
    await expect(page).toHaveTitle(/ — Coralite Blog$/)
  })

  test('the not-found page is noindex', async ({ page }) => {
    await page.goto('/404')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await expect(page).toHaveTitle('Page Not Found — Coralite')
  })
})

test.describe('page metadata source', () => {
  test('every page declares metadata through the shared component', () => {
    const files = collectPages()

    expect(files.length).toBeGreaterThan(170)

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const block = metaBlock(source, file)
      const head = source.match(/<head>([\s\S]*?)<\/head>/)

      expect(head, `${file} has no <head>`).toBeTruthy()
      expect(head[1]).not.toMatch(/<title>/)
      expect(attribute(block, 'title'), `${file} has no title`).toBeTruthy()
      expect(source).toMatch(/<page-meta no-hydration/)
    }
  })

  test('titles and descriptions are unique and within snippet length', () => {
    const titles = new Map()
    const descriptions = new Map()

    for (const file of collectPages()) {
      const block = metaBlock(readFileSync(file, 'utf8'), file)
      const title = attribute(block, 'title')
      const description = attribute(block, 'description')

      expect(description, `${file} has no description`).toBeTruthy()
      expect(description.length, `${file} description is ${description.length} chars`).toBeGreaterThanOrEqual(50)
      expect(description.length, `${file} description is ${description.length} chars`).toBeLessThanOrEqual(170)
      expect(description).not.toMatch(/[<>]/)

      expect(titles.has(title), `${file} duplicates the title of ${titles.get(title)}`).toBe(false)
      expect(descriptions.has(description), `${file} duplicates the description of ${descriptions.get(description)}`).toBe(false)

      titles.set(title, file)
      descriptions.set(description, file)
    }
  })

  test('blog posts carry a real published date', () => {
    const blogDir = join(PAGES_DIR, 'blog')

    for (const entry of readdirSync(blogDir)) {
      if (!entry.endsWith('.html') || entry === 'index.html') {
        continue
      }

      const source = readFileSync(join(blogDir, entry), 'utf8')
      const match = source.match(/<article-meta[\s\S]*?<\/article-meta>/)

      expect(match, `${entry} is missing <article-meta>`).toBeTruthy()
      expect(attribute(match[0], 'published')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(attribute(match[0], 'author')).toBeTruthy()
    }
  })
})
