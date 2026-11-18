import { test, expect } from '../fixtures.js'

test.describe('Interactions', () => {
  test('Command Palette opens with Ctrl+K and closes with Escape', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const overlay = page.locator('.cp-overlay')

    // Client hydration can lag behind load on a cold dev server, so retry the
    // open shortcut until the listener is bound instead of racing it once.
    await expect(async () => {
      await page.keyboard.press('Control+k')
      await expect(overlay).toHaveClass(/is-open/, { timeout: 1000 })
    }).toPass({ timeout: 10000 })

    const input = page.locator('.cp-input')
    await expect(input).toBeFocused()

    // Close palette
    await page.keyboard.press('Escape')
    await expect(overlay).not.toHaveClass(/is-open/)
  })

  test('Homepage shows authored, usage, and compiled steps', async ({ page }) => {
    await page.goto('/')

    const authored = page.locator('[data-code-pane="authored"]')
    const usage = page.locator('[data-code-pane="usage"]')
    const compiled = page.locator('[data-code-pane="compiled"]')

    await expect(authored).toBeVisible()
    await expect(usage).toBeVisible()
    await expect(compiled).toBeVisible()

    // Authored is the left column; usage and compiled stack in the right column.
    const a = await authored.boundingBox()
    const u = await usage.boundingBox()
    const c = await compiled.boundingBox()
    expect(Math.abs(a.y - u.y)).toBeLessThan(4)
    expect(a.x).toBeLessThan(u.x)
    expect(c.y).toBeGreaterThan(u.y)
    expect(Math.abs(c.x - u.x)).toBeLessThan(2)
    expect(Math.abs(c.width - u.width)).toBeLessThan(2)

    await expect(page.getByText('02 Used on a page')).toBeVisible()
    await expect(page.getByText('03 Compiled output (generated)')).toBeVisible()

    await expect(usage).toContainText('<site-counter step="1"></site-counter>')
    await expect(authored).toContainText('export function server')
    await expect(compiled).toContainText('data-cid="site-counter-0"')
    await expect(compiled).toContainText('ref="site-counter-0__count-button"')
    await expect(compiled).toContainText('you never author this markup')
    await expect(page.locator('.toggle-container')).toHaveCount(0)
  })

  test('Homepage education CTA sits above the coral decoration', async ({ page }) => {
    await page.goto('/')
    await page.locator('.education-content ui-link').scrollIntoViewIfNeeded()

    const isOnTop = await page.evaluate(() => {
      const host = document.querySelector('.education-content ui-link')
      const link = host.querySelector('a')
      const rect = link.getBoundingClientRect()
      const top = document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2))
      return host.contains(top)
    })

    expect(isOnTop).toBe(true)
  })

  test('Mobile Nav Drawer opens and closes', async ({ page }) => {
    await page.setViewportSize({
      width: 375,
      height: 812
    })
    await page.goto('/learn/01-the-document')

    const drawer = page.locator('.mobile-drawer')
    const hamburger = page.locator('.hamburger-btn')

    // Open drawer
    await hamburger.click()
    await expect(drawer).toHaveClass(/is-open/)

    // Close via overlay
    await page.locator('.mobile-overlay').click({ force: true })
    await expect(drawer).not.toHaveClass(/is-open/)
  })
})
