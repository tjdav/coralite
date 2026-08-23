import { waitForHydration } from '../../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Circular Dependency Detection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/circular-deps-test/')
    await waitForHydration(page)
  })

  test('should detect and handle circular dependencies without infinite loop', async ({ page }) => {
    const comp = page.locator('circular-deps-test-comp').first()
    const setupBtn = comp.locator('.setup-circular-btn')
    const statusDisplay = comp.locator('.status-display')

    await setupBtn.click()

    // Should either catch the error or have protective mechanism
    const statusText = await statusDisplay.textContent()

    // Either it catches the error or has some protection
    expect(statusText).toMatch(/(Caught|ERROR|Protection)/i)
  })
})
