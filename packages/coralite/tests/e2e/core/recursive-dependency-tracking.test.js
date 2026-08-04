import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Recursive Dependency Tracking - Nested Getters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recursive-deps-test/')
    await waitForHydration(page)
  })

  test('should update nested getter chain when leaf property changes (3 levels)', async ({ page }) => {
    const comp = page.locator('recursive-deps-test-comp').first()
    const selectBtn = comp.locator('.select-participant-btn')
    const disableSubmitDisplay = comp.locator('.disable-submit-display')
    const finalStatusDisplay = comp.locator('.final-status-display')
    const callbackCountDisplay = comp.locator('.callback-count-display')

    // Initial state: no participants selected, button should be disabled
    await expect(disableSubmitDisplay).toHaveText('Button Disabled: true')
    await expect(finalStatusDisplay).toHaveText('Final Status: Button is disabled')
    await expect(callbackCountDisplay).toHaveText('Observer Calls: 0')

    // Select a participant - should cascade through all getters
    await selectBtn.click()

    // Verify all levels updated correctly
    await expect(disableSubmitDisplay).toHaveText('Button Disabled: false')
    await expect(finalStatusDisplay).toHaveText('Final Status: Button is enabled')

    // Observer should have been called exactly once
    await expect(callbackCountDisplay).toHaveText('Observer Calls: 1')
  })

  test('should handle deep getter chains (5+ levels)', async ({ page }) => {
    const comp = page.locator('recursive-deps-test-comp').first()
    const updateLeafBtn = comp.locator('.update-leaf-btn')
    const deepChainDisplay = comp.locator('.deep-chain-display')

    // Initial value: level0=0, so level5 should be 5
    await expect(deepChainDisplay).toHaveText('Deep Chain (5 levels): 5')

    // Update leaf node
    await updateLeafBtn.click()

    // Should cascade through all 5 levels: level0=1, level5=6
    await expect(deepChainDisplay).toHaveText('Deep Chain (5 levels): 6')

    // Update again
    await updateLeafBtn.click()
    await expect(deepChainDisplay).toHaveText('Deep Chain (5 levels): 7')
  })

  test('should handle diamond dependency pattern', async ({ page }) => {
    const comp = page.locator('recursive-deps-test-comp').first()
    const selectBtn = comp.locator('.select-participant-btn')
    const canCreateDisplay = comp.locator('.can-create-display')
    const finalStatusDisplay = comp.locator('.final-status-display')

    // Multiple getters depend on the same source
    await selectBtn.click()

    // All dependent getters should update
    await expect(canCreateDisplay).toHaveText('Can Create: true')
    await expect(finalStatusDisplay).toHaveText('Final Status: Button is enabled')
  })

  test('should revert when deselecting (bidirectional updates)', async ({ page }) => {
    const comp = page.locator('recursive-deps-test-comp').first()
    const selectBtn = comp.locator('.select-participant-btn')
    const deselectBtn = comp.locator('.deselect-participant-btn')
    const disableSubmitDisplay = comp.locator('.disable-submit-display')
    const callbackCountDisplay = comp.locator('.callback-count-display')

    // Select
    await selectBtn.click()
    await expect(disableSubmitDisplay).toHaveText('Button Disabled: false')
    await expect(callbackCountDisplay).toHaveText('Observer Calls: 1')

    // Deselect
    await deselectBtn.click()
    await expect(disableSubmitDisplay).toHaveText('Button Disabled: true')

    // Observer should be called again for the change back
    await expect(callbackCountDisplay).toHaveText('Observer Calls: 2')
  })

  test('should handle very deep chains (stress test)', async ({ page }) => {
    // This test verifies no stack overflow with deep nesting
    const comp = page.locator('recursive-deps-test-comp').first()
    const updateLeafBtn = comp.locator('.update-leaf-btn')
    const deepChainDisplay = comp.locator('.deep-chain-display')

    // Rapid updates to verify stability
    for (let i = 0; i < 10; i++) {
      await updateLeafBtn.click()
    }

    // Should have incremented 10 times from initial value of 5
    await expect(deepChainDisplay).toHaveText('Deep Chain (5 levels): 15')
  })
})

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

test.describe('Async Dependency Resolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/async-deps-test/')
    await waitForHydration(page)
  })

  test('should track dependencies in async getters after resolution', async ({ page }) => {
    const comp = page.locator('async-deps-test-comp').first()
    const loadDataBtn = comp.locator('.load-data-btn')
    const statusDisplay = comp.locator('.async-status-display')
    const derivedDisplay = comp.locator('.derived-from-async-display')

    // Initial state
    await expect(derivedDisplay).toHaveText('Derived: No data')

    // Load async data
    await loadDataBtn.click()

    // Wait for async operation
    await expect(statusDisplay).toHaveText('Status: Loaded')

    // Derived getter should update after async data resolves
    await expect(derivedDisplay).toHaveText('Derived: Processed: 84')
  })
})

test.describe('Slot Ref Liveness & DOM Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slot-ref-test/')
    await waitForHydration(page)
  })

  test('should maintain ref liveness through slot re-projection', async ({ page }) => {
    const comp = page.locator('slot-ref-test-comp').first()
    const checkRefBtn = comp.locator('.check-ref-btn')
    const refCheckDisplay = comp.locator('.ref-check-display')

    // Inject slotted content
    await page.evaluate(() => {
      const comp = document.querySelector('slot-ref-test-comp')
      const btn = document.createElement('button')
      btn.setAttribute('slot', 'action-slot')
      btn.setAttribute('ref', 'slottedBtn')
      btn.textContent = 'Slotted Button'
      comp.appendChild(btn)
    })

    // Check ref liveness
    await checkRefBtn.click()

    // Should find the live button in DOM
    const displayText = await refCheckDisplay.textContent()
    expect(displayText).toContain('Yes (Live)')
  })

  test('should handle component removal and cleanup', async ({ page }) => {
    const comp = page.locator('slot-ref-test-comp').first()
    const removeBtn = page.locator('#reproject-slot-btn')

    // Remove component from DOM
    await page.evaluate(() => {
      const container = document.getElementById('container')
      if (container) container.innerHTML = ''
    })

    await expect(comp).not.toBeAttached()
  })
})

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

test.describe('Dynamic Dependency Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recursive-deps-test/')
    await waitForHydration(page)
  })

  test('should handle getters that conditionally depend on different properties', async ({ page }) => {
    const comp = page.locator('recursive-deps-test-comp').first()
    const incrementBtn = comp.locator('.trigger-increment-btn')
    const selectBtn = comp.locator('.select-participant-btn')

    // Test that multiple independent chains work simultaneously
    await incrementBtn.click()
    await selectBtn.click()

    // Both chains should have updated independently
    const disableSubmitDisplay = comp.locator('.disable-submit-display')
    await expect(disableSubmitDisplay).toHaveText('Button Disabled: false')
  })
})
