import { test, expect } from '@playwright/test'

test.describe('Client Script', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/client-script/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  test('should execute script, setup context, and test reactivity', async ({ page }) => {
    // Because it is mounted imperatively, the instance counter for child might be 0.
    const title = page.getByTestId('client-script-component__titleDisplay-0')
    await expect(title).toHaveText('Initial Parent')

    const status = page.getByTestId('client-script-component__statusDisplay-0')
    await expect(status).toHaveText('Status: Offline')

    const btn = page.getByTestId('client-script-component__updateBtn-0')
    await btn.click()

    await expect(title).toHaveText('Updated')
    await expect(status).toHaveText('Status: Online')

    const host = page.getByTestId('mounted-child')
    await expect(host).toHaveAttribute('data-confetti', 'loaded')
  })
})
