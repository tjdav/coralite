import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Testing Mode Features', () => {
  test('should support server mocking', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)

    const comp = page.locator('mocking-test').first()
    const data = comp.getByTestId('data')
    await expect(data).toHaveText('MOCKED DATA')
  })

  test('should support data-testid for elements with testid attribute', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)

    const btn = page.getByTestId('test-btn')
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
