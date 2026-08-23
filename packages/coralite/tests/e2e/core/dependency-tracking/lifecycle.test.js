import { waitForHydration } from '../../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Integration: observe with AbortSignal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recursive-deps-test/')
    await waitForHydration(page)
  })

  test('should properly unsubscribe observers when component is removed', async ({ page }) => {
    const comp = page.locator('recursive-deps-test-comp').first()
    const selectBtn = comp.locator('.select-participant-btn')
    const callbackCountDisplay = comp.locator('.callback-count-display')

    // Trigger an update to establish observer
    await selectBtn.click()
    await expect(callbackCountDisplay).toHaveText('Observer Calls: 1')

    // Store reference to component
    await page.evaluate(() => {
      window.testCompRef = document.getElementById('recursive-comp')
    })

    // Remove component from DOM
    const removeBtn = page.locator('#remove-btn')
    await removeBtn.click()

    await expect(comp).not.toBeAttached()

    // Try to mutate state on removed component - should not trigger observer
    const callbackCallsAfter = await page.evaluate(() => {
      if (window.testCompRef && window.testCompRef._state) {
        window.testCompRef._state.selectedParticipants = ['Alice']
        const display = window.testCompRef.querySelector('.callback-count-display')
        return display ? display.textContent : null
      }
      return null
    })

    // Observer count should remain at 1 (no new calls after removal)
    expect(callbackCallsAfter).toBe('Observer Calls: 1')
  })
})
