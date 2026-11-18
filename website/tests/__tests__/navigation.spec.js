import { test, expect } from '../fixtures.js'

test('client-side navigation applies the destination page styles', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Mark the document so we can assert navigation did not reload the page.
  await page.evaluate(() => {
    window.__sameDocument = true
  })

  await page.click('.desktop-nav a[href="/why/"]')
  await expect(page).toHaveURL(/\/why\/$/)

  expect(await page.evaluate(() => window.__sameDocument)).toBe(true)
  await expect(page.locator('main.why-page .hero-section h1')).toHaveCSS('font-size', '56px')
  await expect(page.locator('main.why-page section').first()).toHaveCSS('padding', '0px')

  await page.click('.desktop-nav a[href="/blog/"]')
  await expect(page).toHaveURL(/\/blog\/$/)

  expect(await page.evaluate(() => window.__sameDocument)).toBe(true)
  await expect(page.locator('main.blog-page .hero-section h1')).toHaveCSS('font-size', '48px')

  await page.click('.desktop-nav a[href="/compare/"]')
  await expect(page).toHaveURL(/\/compare\/$/)

  expect(await page.evaluate(() => window.__sameDocument)).toBe(true)
  await expect(page.locator('main.compare-page .hero-section h1')).toHaveCSS('font-size', '48px')
})
