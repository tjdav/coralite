import { test, expect } from '../fixtures.js'

test('header renders a glass backdrop', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const styles = await page.evaluate(() => {
    const host = document.querySelector('site-header')
    const glass = getComputedStyle(host, '::before')
    return {
      position: getComputedStyle(host).position,
      backdrop: glass.backdropFilter || glass.webkitBackdropFilter,
      background: glass.backgroundColor
    }
  })

  expect(styles.position).toBe('sticky')
  expect(styles.backdrop).toContain('blur')
  expect(styles.background).toMatch(/rgba\(11, 15, 25, 0\.68\)/)
})

test('hero has a subtle decorative ray layer', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const rays = page.locator('.hero-rays')
  await expect(rays).toHaveCount(1)
  await expect(rays).toHaveAttribute('aria-hidden', 'true')
  await expect(rays).toHaveCSS('pointer-events', 'none')
  await expect(rays).toHaveCSS('animation-name', 'hero-rays-drift')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(rays).toHaveCSS('animation-name', 'none')
})
