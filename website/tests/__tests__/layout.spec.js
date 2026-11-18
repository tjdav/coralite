import { test, expect } from '../fixtures.js'

test('inline code uses the global code style', async ({ page }) => {
  await page.goto('/blog/ai-versioning-trap')
  await page.waitForLoadState('networkidle')

  const code = page.locator('.post-body p code').first()
  await expect(code).toHaveCSS('background-color', 'rgb(17, 24, 39)')
  await expect(code).toHaveCSS('color', 'rgb(6, 182, 212)')
  await expect(code).toHaveCSS('padding-top', '2px')
})

test('code blocks are not treated as inline code', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const code = page.locator('code-block code').first()
  await expect(code).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(code).toHaveCSS('padding-top', '0px')
})

test('home sections are full-bleed with contained content', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const at1440 = await page.evaluate(() => {
    const section = document.querySelector('.progression-section').getBoundingClientRect()
    const heading = document.querySelector('.progression-section h2').getBoundingClientRect()
    return {
      sectionWidth: Math.round(section.width),
      viewportWidth: document.documentElement.clientWidth,
      headingLeft: Math.round(heading.left)
    }
  })

  expect(at1440.sectionWidth).toBe(at1440.viewportWidth)
  expect(at1440.headingLeft).toBe(24)

  await page.setViewportSize({ width: 1920, height: 900 })
  await page.waitForTimeout(200)

  const at1920 = await page.evaluate(() => {
    const section = document.querySelector('.progression-section').getBoundingClientRect()
    const heading = document.querySelector('.progression-section h2').getBoundingClientRect()
    return {
      sectionWidth: Math.round(section.width),
      viewportWidth: document.documentElement.clientWidth,
      headingLeft: Math.round(heading.left)
    }
  })

  expect(at1920.sectionWidth).toBe(at1920.viewportWidth)
  expect(at1920.headingLeft).toBe(240)
})
