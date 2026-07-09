import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Observe Context Method Explicit State Side-effects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/observe-test/')
    await waitForHydration(page)
  })

  test('should trigger basic reactivity and side-effects on state change', async ({ page }) => {
    const comp = page.locator('observe-test-comp').first()
    const scoreDisplay = comp.locator('.score-display')
    const sideEffectDisplay = comp.locator('.side-effect-display')
    const callbackCountDisplay = comp.locator('.callback-count-display')

    await expect(scoreDisplay).toHaveText('10')
    await expect(sideEffectDisplay).toHaveText('Initialized')
    await expect(callbackCountDisplay).toHaveText('0')

    const triggerBtn = comp.locator('.trigger-btn')
    await triggerBtn.click()

    await expect(scoreDisplay).toHaveText('15')
    await expect(sideEffectDisplay).toHaveText('Observed Change: 10 -> 15')
    await expect(callbackCountDisplay).toHaveText('1')
  })

  test('should not invoke callback if mutated property value is identical', async ({ page }) => {
    const comp = page.locator('observe-test-comp').first()
    const scoreDisplay = comp.locator('.score-display')
    const callbackCountDisplay = comp.locator('.callback-count-display')

    await expect(scoreDisplay).toHaveText('10')
    await expect(callbackCountDisplay).toHaveText('0')

    const triggerSameBtn = comp.locator('.trigger-same-btn')
    await triggerSameBtn.click()

    await expect(scoreDisplay).toHaveText('10')
    await expect(callbackCountDisplay).toHaveText('0')
  })

  test('should observe dynamic properties not defined in attributes', async ({ page }) => {
    const comp = page.locator('observe-test-comp').first()
    const sideEffectDisplay = comp.locator('.side-effect-display')

    await expect(sideEffectDisplay).toHaveText('Initialized')

    const triggerDynamicBtn = comp.locator('.trigger-dynamic-btn')
    await triggerDynamicBtn.click()

    await expect(sideEffectDisplay).toHaveText('Dynamic Change: active')
  })

  test('should handle garbage collection and lifecycle cleanup on AbortSignal/disconnection', async ({ page }) => {
    const comp = page.locator('observe-test-comp').first()
    const scoreDisplay = comp.locator('.score-display')
    const callbackCountDisplay = comp.locator('.callback-count-display')

    await expect(scoreDisplay).toHaveText('10')
    await expect(callbackCountDisplay).toHaveText('0')

    await page.evaluate(() => {
      window.testCompRef = document.getElementById('observe-comp')
    })

    const removeBtn = page.locator('#remove-btn')
    await removeBtn.click()

    await expect(comp).not.toBeAttached()

    const callbackCallsAfter = await page.evaluate(() => {
      if (window.testCompRef && window.testCompRef._state) {
        window.testCompRef._state.score = 99
        const display = window.testCompRef.querySelector('.callback-count-display')
        return display ? display.textContent : null
      }
      return null
    })

    expect(callbackCallsAfter).toBe('0')
  })

  test('should trigger infinite loop console warning exactly as expected in dev mode', async ({ page }) => {
    const mode = await page.evaluate(() => window.__coralite__.mode)

    const warnings = []
    page.on('console', msg => {
      if (msg.type() === 'warning' || msg.text().includes('[Coralite Warning]')) {
        warnings.push(msg.text())
      }
    })

    const triggerLoopBtn = page.locator('.trigger-loop-btn').first()
    await triggerLoopBtn.click()

    // Give a short timeout for logs to flush
    await page.waitForTimeout(50)

    const expectedWarning = '[Coralite Warning]: State mutation detected inside an observe() callback. This can cause infinite reactivity loops. Use getters for derived state instead.'

    if (mode === 'development') {
      expect(warnings).toContain(expectedWarning)
    } else if (mode === 'production') {
      expect(warnings).not.toContain(expectedWarning)
    } else if (mode === 'testing') {
      expect(warnings).toContain(expectedWarning)
    }
  })
})
