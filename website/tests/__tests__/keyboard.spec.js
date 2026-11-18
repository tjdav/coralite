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

  await page.keyboard.press('Shift+Tab')
  const wrappedToLast = await page.evaluate(() => {
    const focusable = Array.from(document.querySelectorAll('.mobile-drawer a[href], .mobile-drawer button:not([disabled])'))
    return document.activeElement === focusable[focusable.length - 1]
  })
  expect(wrappedToLast).toBe(true)

  await page.keyboard.press('Escape')
  await expect(drawer).toHaveAttribute('inert', '')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()
})

test('code blocks are keyboard-focusable regions', async ({ page }) => {
  await page.goto('/docs/guide/getting-started/')

  const pre = page.locator('.code-body').first()
  await expect(pre).toHaveAttribute('tabindex', '0')
  await expect(pre).toHaveAttribute('role', 'region')
  await expect(pre).toHaveAttribute('aria-label', /Code sample/)
})
