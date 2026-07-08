import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Client Script', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/client-script/')
    await waitForHydration(page)
  })

  test('should execute script, setup context, and test reactivity', async ({ page }) => {
    const comp = page.locator('client-script-component').first()
    const title = comp.locator('.title-display')
    await expect(title).toHaveText('Initial Parent')

    const status = comp.locator('.status-display')
    await expect(status).toHaveText('Status: Offline')

    const btn = comp.locator('.update-btn')
    await btn.click()

    await expect(title).toHaveText('Updated')
    await expect(status).toHaveText('Status: Online')

    const container = comp.locator('.container')
    await expect(container).toHaveAttribute('data-confetti', 'loaded')

    const dynamicDisplay = comp.locator('.dynamic-display')
    await expect(dynamicDisplay).toHaveText('foo', { timeout: 10000 })
  })
})
