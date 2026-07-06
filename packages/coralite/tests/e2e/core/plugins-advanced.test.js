import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Advanced Plugin Features', () => {
  test('Plugin Service Registry: should verify server-side and client-side resolution', async ({ page }) => {
    await page.goto('/plugins/registry-test/')
    await waitForHydration(page)

    const comp = page.locator('registry-test-component').first()

    // SSR
    const serverResult = comp.locator('p').nth(1)
    await expect(serverResult).toHaveText('Server Data from DB')

    // Interactivity
    const clientResult = comp.locator('p').nth(2)
    const actionButton = comp.locator('button')

    await expect(clientResult).toHaveText('Initial Client State')
    await actionButton.click()
    await expect(clientResult).toHaveText('Client Action Performed')
  })

  test('Plugin State Mutation: should verify global context mutation propagation', async ({ page }) => {
    await page.goto('/plugins/mutation-test/')
    await waitForHydration(page)

    const comp = page.locator('mutation-test-component').first()

    const serverResult = comp.locator('p').first()
    await expect(serverResult).toHaveText('Server Data from DB')

    const clientResult = comp.locator('p').last()
    const actionButton = comp.locator('button')

    await expect(clientResult).toHaveText('Initial Client State')
    await actionButton.click()
    await expect(clientResult).toHaveText('Client Action Performed')
  })
})
