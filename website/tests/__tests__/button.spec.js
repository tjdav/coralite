import { test, expect } from '../fixtures.js'

test('site-header visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const header = page.locator('site-header')
  await expect(header).toHaveScreenshot('site-header.png')
})

test('ui-button variants visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#button-test-container')
  await expect(container).toHaveScreenshot('buttons.png')
})

test('ui-link variants visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')

  const container = page.locator('#link-test-container')
  await expect(container).toHaveScreenshot('links.png')
})

test('ui-card variants visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#card-test-container')
  await expect(container).toHaveScreenshot('cards.png')
})

test('ui-badge variants visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#badge-test-container')
  await expect(container).toHaveScreenshot('badges.png')
})

test('ui-input visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#input-test-container')
  await expect(container).toHaveScreenshot('input.png')
})

test('ui-toggle visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#toggle-test-container')
  await expect(container).toHaveScreenshot('toggle.png')
})

test('ui-nav-link visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#nav-link-test-container')
  await expect(container).toHaveScreenshot('nav-link.png')
})

test('ui-accordion visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#accordion-test-container')
  await expect(container).toHaveScreenshot('accordion.png')
})

test('ui-breadcrumb visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#breadcrumb-test-container')
  await expect(container).toHaveScreenshot('breadcrumb.png')
})

test('ui-tooltip visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  const container = page.locator('#tooltip-test-container')
  const tooltip = page.locator('#tooltip-test-container .tooltip-floating')

  // Hydration can lag on a cold dev server: retry the hover until bound.
  await expect(async () => {
    // Move away first so each retry fires a fresh mouseenter.
    await page.mouse.move(0, 0)
    await page.hover('#tooltip-test-container .tooltip-reference')
    await expect(tooltip).toHaveAttribute('aria-hidden', 'false', { timeout: 1000 })
  }).toPass({ timeout: 10000 })

  // Wait for the tooltip to become visible (opacity transition included)
  await expect(tooltip).toHaveCSS('opacity', '1')
  await expect(tooltip).toHaveAttribute('data-placement', /(top|bottom|left|right)/)

  // Floating UI repositions after fonts/layout settle; wait for two frames
  // with an unchanged position before capturing.
  await page.waitForFunction(() => {
    const el = document.querySelector('#tooltip-test-container .tooltip-floating')
    if (!el) return false
    const first = el.getBoundingClientRect()
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const second = el.getBoundingClientRect()
          resolve(Math.abs(first.x - second.x) < 0.25 && Math.abs(first.y - second.y) < 0.25)
        })
      })
    })
  }, undefined, { timeout: 5000 })
  
  // Cold dev-server runs occasionally capture a frame before the floating
  // layer settles; retry the comparison once the page is quiet.
  await expect(async () => {
    await expect(container).toHaveScreenshot('tooltip.png', { timeout: 2000 })
  }).toPass({ timeout: 10000 })
})

test('ui-avatar visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#avatar-test-container')
  await expect(container).toHaveScreenshot('avatars.png')
})

test('ui-terminal visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#terminal-test-container')
  await expect(container).toHaveScreenshot('terminal.png')
})

test('code-block visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const container = page.locator('#code-test-container')
  await expect(container).toHaveScreenshot('code-block.png')
})

test('site-footer visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  const footer = page.locator('site-footer')
  await expect(footer).toHaveScreenshot('site-footer.png')
})

test('site-mobile-nav visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  await page.click('#test-mobile-nav .hamburger-btn')
  await page.waitForTimeout(400)
  const container = page.locator('#mobile-nav-test-container')
  await expect(container).toHaveScreenshot('mobile-nav.png')
})

test('ui-command-palette visual test', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  // Simulate Ctrl+K until the palette's client listener is bound
  await expect(async () => {
    await page.keyboard.press('Control+k')
    await expect(page.locator('#test-cp .cp-overlay')).toHaveClass(/is-open/, { timeout: 1000 })
  }).toPass({ timeout: 10000 })
  
  // Wait for the icon component to hydrate; its width shifts the input.
  await expect(page.locator('#test-cp .cp-icon svg')).toHaveCount(1)

  const container = page.locator('#test-cp')
  await expect(container).toHaveScreenshot('command-palette.png')
})

test('site-header opens command palette', async ({ page }) => {
  await page.goto('/__tests__/atoms')
  
  // Click the search button until hydration has bound the palette. Use
  // dispatchEvent so retries are not blocked by the open overlay.
  await expect(async () => {
    await page.locator('site-header .search-btn').dispatchEvent('click')
    await expect(page.locator('site-header ui-command-palette .cp-overlay')).toHaveClass(/is-open/, { timeout: 1000 })
  }).toPass({ timeout: 10000 })
  
  await expect(page.locator('site-header ui-command-palette .cp-icon svg')).toHaveCount(1)

  // Take a screenshot of the header (which now includes the palette overlay)
  const header = page.locator('site-header')
  await expect(header).toHaveScreenshot('header-with-palette.png')
})
