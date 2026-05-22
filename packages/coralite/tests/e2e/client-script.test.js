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
    const title = page.getByTestId(/client-script-component__titleDisplay-\d+/)
    await expect(title).toHaveText('Initial Parent')

    const status = page.getByTestId(/client-script-component__statusDisplay-\d+/)
    await expect(status).toHaveText('Status: Offline')

    const btn = page.getByTestId(/client-script-component__updateBtn-\d+/)
    await btn.click()

    await expect(title).toHaveText('Updated')
    await expect(status).toHaveText('Status: Online')

    const container = page.getByTestId(/client-script-component__container-\d+/)
    await expect(container).toHaveAttribute('data-confetti', 'loaded')
  })
})
