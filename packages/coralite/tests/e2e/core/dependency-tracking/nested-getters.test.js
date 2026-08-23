import { waitForHydration } from '../../helpers.js'
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
