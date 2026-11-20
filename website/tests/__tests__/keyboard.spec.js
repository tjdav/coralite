import { test, expect } from '../fixtures.js'

test('skip link moves focus to the main landmark', async ({ page }) => {
  await page.goto('/')

  await page.keyboard.press('Tab')
  await expect(page.locator('.skip-link')).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
})

test('command palette is a keyboard-operable combobox', async ({ page }) => {
  await page.goto('/')
  await page.locator('.search-btn').click()

  const input = page.locator('.cp-input')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('role', 'combobox')
  await expect(input).toHaveAttribute('aria-activedescendant', 'cp-option-0')
  await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(1)

  await page.keyboard.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', 'cp-option-1')

  await page.keyboard.press('Tab')
  await expect(input).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(input).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.locator('.cp-overlay')).not.toHaveClass(/is-open/)
  await expect(page.locator('.search-btn')).toBeFocused()
})

test('mobile drawer starts inert, traps focus and restores it', async ({ page }) => {
  await page.setViewportSize({
    width: 390,
    height: 844
  })
  await page.goto('/')

  const toggle = page.locator('.hamburger-btn')
  const drawer = page.locator('.mobile-drawer')

  await expect(drawer).toHaveAttribute('inert', '')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveAttribute('aria-label', 'Close menu')
  await expect(drawer).not.toHaveAttribute('inert', '')
  await expect(page.locator('.close-btn')).toBeFocused()

  await page.locator('.drawer-logo').focus()
  await page.keyboard.press('Shift+Tab')
  const wrappedToLast = await page.evaluate(() => {
    const focusable = Array.from(document.querySelectorAll('.mobile-drawer a[href], .mobile-drawer button:not([disabled]), .mobile-drawer input'))
    return document.activeElement === focusable[focusable.length - 1]
  })
  expect(wrappedToLast).toBe(true)

  await page.keyboard.press('Escape')
  await expect(drawer).toHaveAttribute('inert', '')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()
})

test('mobile docs navigation disclosures toggle', async ({ page }) => {
  await page.setViewportSize({
    width: 390,
    height: 844
  })
  await page.goto('/docs/guide/targets/')
  await page.waitForLoadState('networkidle')

  const navToggle = page.locator('.sidebar-wrapper .mobile-disclosure-toggle')
  const navPanel = page.locator('#docs-nav-panel')
  const tocToggle = page.locator('.toc-wrapper .mobile-disclosure-toggle')
  const tocPanel = page.locator('#docs-toc-panel')

  await expect(navToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(navPanel).toHaveAttribute('data-collapsed', 'true')
  await expect(tocToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(tocPanel).toHaveAttribute('data-collapsed', 'true')

  await navToggle.click()
  await expect(navToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(navPanel).not.toHaveAttribute('data-collapsed', 'true')
  await expect(page.locator('#docs-nav-panel a[href="/docs/guide/components/"]')).toBeVisible()

  await tocToggle.click()
  await expect(tocToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(tocPanel).not.toHaveAttribute('data-collapsed', 'true')
  await expect(page.locator('#docs-toc-panel a[href="#what-is-shared"]')).toBeVisible()
})

test('mobile drawer search opens the command palette', async ({ page }) => {
  await page.setViewportSize({
    width: 390,
    height: 844
  })
  await page.goto('/')
  await page.locator('.hamburger-btn').click()
  await page.locator('.drawer-search').click()

  await expect(page.locator('.cp-overlay')).toHaveClass(/is-open/)
  await expect(page.locator('.mobile-drawer')).toHaveAttribute('inert', '')
})

test('code blocks are keyboard-focusable regions', async ({ page }) => {
  await page.goto('/docs/guide/getting-started/')

  const pre = page.locator('.code-body').first()
  await expect(pre).toHaveAttribute('tabindex', '0')
  await expect(pre).toHaveAttribute('role', 'region')
  await expect(pre).toHaveAttribute('aria-label', /Code sample/)
})
