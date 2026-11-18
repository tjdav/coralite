import { test, expect } from '../fixtures.js'

test('accordions are open by default', async ({ page }) => {
  await page.goto('/reference/client')
  await page.waitForLoadState('networkidle')

  const accordions = page.locator('aside.sidebar-wrapper ui-accordion')
  const count = await accordions.count()
  expect(count).toBeGreaterThan(0)

  await expect(page.locator('aside.sidebar-wrapper ui-accordion details[open]')).toHaveCount(count)
})

test('accordion headers stay inside their container', async ({ page }) => {
  await page.goto('/reference/client')
  await page.waitForLoadState('networkidle')

  const fits = await page.evaluate(() => {
    return [...document.querySelectorAll('aside.sidebar-wrapper ui-accordion')].every((accordion) => {
      const details = accordion.querySelector('details')
      const header = accordion.querySelector('.accordion-header')
      if (!details || !header) return false
      const outer = details.getBoundingClientRect()
      const inner = header.getBoundingClientRect()
      return inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5
    })
  })

  expect(fits).toBe(true)
})
