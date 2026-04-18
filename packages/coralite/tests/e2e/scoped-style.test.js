import { test, expect } from '@playwright/test'

test.describe('Scoped Styles', () => {
  test('client side generated styles should be scoped correctly', async ({ page }) => {
    await page.goto('/scoped-style.html')

    // Wait for the dynamically inserted component to be defined and render its DOM
    await page.waitForFunction(() => {
      const comp = document.querySelector('scoped-style-component')
      if (!comp) {
        return false
      }
      const div = comp.querySelector('div.red')
      return div && window.getComputedStyle(div).color === 'rgb(255, 0, 0)'
    }, { timeout: 5000 })

    const color = await page.evaluate(() => {
      const comp = document.querySelector('scoped-style-component')
      const div = comp.querySelector('div.red')
      return window.getComputedStyle(div).color
    })

    expect(color).toBe('rgb(255, 0, 0)')

    // Verify style wrapper is correctly set
    const styleContent = await page.evaluate(() => {
      const comp = document.querySelector('scoped-style-component')
      const style = comp.querySelector('style')
      return style ? style.textContent : null
    })

    expect(styleContent).toContain('[data-style-selector="scoped-style-component"]')
  })
})
