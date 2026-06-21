import { test, expect } from '@playwright/test'

test.describe('Client Script', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/client-script/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should execute script, setup context, and test reactivity', async ({ page }) => {
    const title = page.getByTestId(/client-script-component-0__titleDisplay/)
    await expect(title).toHaveText('Initial Parent')

    const status = page.getByTestId(/client-script-component-0__statusDisplay/)
    await expect(status).toHaveText('Status: Offline')

    const btn = page.getByTestId(/client-script-component-0__updateBtn/)
    await btn.click()

    await expect(title).toHaveText('Updated')
    await expect(status).toHaveText('Status: Online')

    const container = page.getByTestId(/client-script-component-0__container/)
    await expect(container).toHaveAttribute('data-confetti', 'loaded')

    const dynamicDisplay = page.getByTestId(/client-script-component-0__dynamic-display/)
    await expect(dynamicDisplay).toHaveText('foo', { timeout: 10000 })
  })
})
