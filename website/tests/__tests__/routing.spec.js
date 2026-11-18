import { test, expect } from '../fixtures.js'

const PAGES = [
  '/',
  '/why',
  '/compare',
  '/docs/guide/getting-started',
  '/reference/client',
  '/learn/',
  '/blog/',
  '/blog/coralite-v0-43-1',
  '/changelog/',
  '/404'
]

const LEGACY_REDIRECTS = {
  '/blog/page/2.html': '/blog/',
  '/blog/page/3.html': '/blog/',
  '/blog/page/4.html': '/blog/',
  '/blog/page/5.html': '/blog/',
  '/blog/page/6.html': '/blog/',
  '/blog/page/7.html': '/blog/',
  '/docs/guide.html': '/docs/guide/',
  '/docs/reference.html': '/docs/reference/',
  '/docs/reference/plugins.html': '/docs/reference/plugins/'
}

test.describe('public routes', () => {
  for (const path of PAGES) {
    test(`${path} serves a canonical document`, async ({ page }) => {
      const response = await page.goto(path)

      expect(response.status()).toBeLessThan(500)
      await expect(page.locator('head > title')).toHaveCount(1)
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
    })
  }
})

test.describe('legacy redirects', () => {
  test.skip(!process.env.BASE_URL, 'Set BASE_URL to a deployed preview to verify _redirects')

  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    test(`${from} redirects to ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 })

      expect(response.status()).toBe(301)
      expect(new URL(response.headers().location, process.env.BASE_URL).pathname).toBe(to)
    })
  }
})
