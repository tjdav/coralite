import { test, expect } from '../fixtures.js'

test('the logo links to the homepage', async ({ page }) => {
  await page.goto('/reference/client')
  await page.waitForLoadState('networkidle')

  const logo = page.locator('site-header .logo-link')
  await expect(logo).toHaveAttribute('href', '/')
  await expect(logo).toHaveAccessibleName('Coralite')

  await page.evaluate(() => {
    window.__sameDocument = true
  })
  await logo.click()

  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true)
})

test('navigation links render as anchors, not nested buttons', async ({ page }) => {
  for (const url of ['/', '/learn/01-the-document/', '/reference/client/', '/docs/guide/ssr/']) {
    await page.goto(url)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('a ui-button')).toHaveCount(0)
    await expect(page.locator('a button')).toHaveCount(0)
  }

  await page.goto('/reference/client')
  await page.waitForLoadState('networkidle')

  const next = page.locator('.lesson-navigation ui-link a[href="/reference/server/"]')
  await expect(next).toHaveCount(1)
  await expect(next).toHaveAttribute('href', '/reference/server/')
})

test('prev/next navigation works from the keyboard', async ({ page }) => {
  await page.goto('/reference/client')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => {
    window.__sameDocument = true
  })

  const next = page.locator('.lesson-navigation ui-link a[href="/reference/server/"]')
  await next.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/reference\/server\/$/)
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true)
})

test('secondary links use the design system instead of native button styles', async ({ page }) => {
  await page.goto('/reference/client')
  await page.waitForLoadState('networkidle')

  const link = page.locator('ui-link a.c-link--secondary').first()
  await expect(link).toBeVisible()
  await expect(link).toHaveCSS('text-decoration-line', 'none')

  const borderColor = await link.evaluate((el) => getComputedStyle(el).borderTopColor)
  expect(borderColor).toBe('rgb(107, 114, 128)')
})

test('external links get target and rel', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  await page.waitForLoadState('networkidle')

  const external = page.locator('ui-link a[href="https://example.com"]')
  await expect(external).toHaveAttribute('target', '_blank')
  await expect(external).toHaveAttribute('rel', 'noopener noreferrer')
})

test('footer View Source links to the repository', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const link = page.locator('site-footer .footer-bottom a[href="https://github.com/tjdav/coralite"]')
  await expect(link).toHaveText('View Source')
  await expect(link).toHaveAttribute('href', 'https://github.com/tjdav/coralite')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('the current section renders as a filled pill in the primary nav', async ({ page }) => {
  await page.goto('/docs/guide/getting-started/')
  await page.waitForLoadState('networkidle')

  const current = page.locator('.desktop-nav a[aria-current="page"]')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveText('Docs')

  const style = await current.evaluate(el => {
    const computed = getComputedStyle(el)
    return {
      background: computed.backgroundColor,
      radius: computed.borderRadius,
      color: computed.color
    }
  })
  expect(style.background).toBe('rgb(124, 58, 237)')
  expect(style.radius).toBe('9999px')
  expect(style.color).toBe('rgb(255, 255, 255)')

  await expect(page.locator('.desktop-nav a', { hasText: 'Learn' })).not.toHaveAttribute('aria-current', 'page')
})
