import { test, expect } from '../fixtures.js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PAGES = [
  {
    path: '/legal/',
    title: 'Legal Notice — Coralite',
    heading: 'Legal Notice'
  },
  {
    path: '/privacy/',
    title: 'Privacy Policy — Coralite',
    heading: 'Privacy Policy'
  },
  {
    path: '/terms/',
    title: 'Terms of Use — Coralite',
    heading: 'Terms of Use'
  },
  {
    path: '/license/',
    title: 'Licensing — Coralite',
    heading: 'Licensing'
  },
  {
    path: '/accessibility/',
    title: 'Accessibility — Coralite',
    heading: 'Accessibility'
  }
]

const LEGAL_LINKS = ['/privacy/', '/terms/', '/license/', '/legal/', '/accessibility/']

test.describe('legal pages', () => {
  for (const entry of PAGES) {
    test(`${entry.path} renders with canonical metadata`, async ({ page }) => {
      const response = await page.goto(entry.path)

      expect(response.status()).toBe(200)
      await expect(page).toHaveTitle(entry.title)
      await expect(page.locator('main h1')).toHaveText(entry.heading)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://coralite.dev${entry.path}`)
      await expect(page.locator('.legal-updated time')).toHaveAttribute('datetime', '2026-11-18')
    })
  }

  test('the footer links every legal page', async ({ page }) => {
    await page.goto('/')

    for (const href of LEGAL_LINKS) {
      await expect(page.locator(`footer .footer-col a[href="${href}"]`)).toHaveCount(1)
    }

    await expect(page.locator('footer .footer-bottom a[href="/license/"]')).toHaveText('MPL-2.0')
  })

  test('only the legal notice is noindex', async ({ page }) => {
    await page.goto('/legal/')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')

    for (const path of ['/privacy/', '/terms/', '/license/', '/accessibility/']) {
      await page.goto(path)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/)
    }
  })

  test('operator identity appears only on the legal notice', async ({ page }) => {
    await page.goto('/legal/')
    await expect(page.locator('main')).toContainText('Y2502576Y')
    await expect(page.locator('main')).toContainText('Gran Via de les Corts Catalanes')

    for (const path of ['/', '/privacy/', '/terms/', '/license/', '/accessibility/']) {
      await page.goto(path)
      await expect(page.locator('main')).not.toContainText('Y2502576Y')
      await expect(page.locator('main')).not.toContainText('Gran Via de les Corts Catalanes')
    }
  })
})

test.describe('privacy guards', () => {
  test('the site sets no cookies, keeps no client storage and makes no third-party requests', async ({ page }) => {
    const baseURL = test.info().project.use.baseURL
    const origin = new URL(baseURL).origin
    const thirdParty = []

    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.protocol.startsWith('http') && url.origin !== origin) {
        thirdParty.push(request.url())
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const state = await page.evaluate(async () => ({
      cookies: document.cookie,
      local: localStorage.length,
      session: sessionStorage.length,
      databases: typeof indexedDB.databases === 'function'
        ? (await indexedDB.databases()).length
        : 0
    }))

    expect(state).toEqual({
      cookies: '',
      local: 0,
      session: 0,
      databases: 0
    })
    expect(thirdParty).toEqual([])
  })
})

test('sitemap excludes noindex pages', () => {
  const sitemapPath = join(process.cwd(), 'dist', 'sitemap.xml')
  test.skip(!existsSync(sitemapPath), 'Run pnpm website:build before this test')

  const sitemap = readFileSync(sitemapPath, 'utf8')

  expect(sitemap).not.toContain('/legal/')
  for (const path of ['/privacy/', '/terms/', '/license/', '/accessibility/']) {
    expect(sitemap).toContain(`https://coralite.dev${path}`)
  }
})
