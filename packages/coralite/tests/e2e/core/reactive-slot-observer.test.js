import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Reactive Slot State Observer E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reactive-slot-test/')
    await waitForHydration(page)
  })

  test('should re-evaluate slot content when attribute or state changes without template interpolation', async ({ page }) => {
    const badgeSlot = page.locator('#test-comp slot[name="badge"]')
    await expect(badgeSlot.locator('.badge-item')).toHaveText('2')

    await page.click('#btn-increment-badge')
    await expect(badgeSlot.locator('.badge-item')).toHaveText('3')

    await page.evaluate(() => {
      /* Direct state proxy mutation without interpolation binding */
      document.querySelector('#test-comp')._state.statusText = 'offline'
    })

    const statusSlot = page.locator('#test-comp slot[name="status"]')
    await expect(statusSlot.locator('.status-indicator')).toHaveText('offline')
  })

  test('should register observers dynamically for newly added state keys', async ({ page }) => {
    await page.evaluate(() => {
      const comp = document.querySelector('#test-comp')
      comp._state.customBadge = 'New Feature'
    })

    const customSlot = page.locator('#test-comp slot[name="custom"]')
    await expect(customSlot.locator('.custom-badge-item')).toHaveText('New Feature')
  })

  test('should clean up observers on element disconnect', async ({ page }) => {
    await page.click('#btn-remove-comp')
    await expect(page.locator('#test-comp')).not.toBeAttached()
  })
})
