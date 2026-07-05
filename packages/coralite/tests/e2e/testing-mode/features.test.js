import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Testing Mode Features', () => {
  test('should support server mocking', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)

    // testingPlugin auto-injects data-testid for components and interactive elements
    const data = page.getByTestId('mocking-test-0__data')
    await expect(data).toHaveText('MOCKED DATA')
  })

  test('should auto-inject data-testid for interactive elements', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)

    // button has ref="test-btn", so data-testid should be "page__test-btn" (since it's in the page)
    const btn = page.getByTestId('page__test-btn')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveText('Click Me')
  })

  test('should disable animations (Velocity Engine)', async ({ page }) => {
    await page.goto('/')
    const styles = await page.evaluate(() => {
      const el = document.createElement('div')
      el.style.animationName = 'fade'
      el.style.animationDuration = '1s'
      document.body.appendChild(el)
      const computed = window.getComputedStyle(el)
      return {
        animationName: computed.animationName,
        animationDuration: computed.animationDuration,
        transitionProperty: computed.transitionProperty
      }
    })
    expect(styles.animationName).toBe('none')
    expect(styles.animationDuration).toBe('0s')
  })
})
