import { waitForHydration } from '../../helpers.js'
import { test, expect } from '@playwright/test'

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

    // Remove component from DOM
    await page.evaluate(() => {
      const container = document.getElementById('container')
      if (container) container.innerHTML = ''
    })

    await expect(comp).not.toBeAttached()
  })
})
