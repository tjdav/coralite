import { waitForHydration } from './helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Advanced Plugin Features', () => {
  test('Plugin Service Registry: should verify server-side and client-side resolution', async ({ page }) => {
    await page.goto('/plugins/registry-test/')
    await waitForHydration(page)

    const comp = page.locator('registry-test-component')
    const instanceId = await comp.getAttribute('data-cid')

    // SSR
    const serverResult = page.getByTestId(`${instanceId}__server-result`)
    await expect(serverResult).toHaveText('Server Data from DB')

    // Interactivity
    const clientResult = page.getByTestId(`${instanceId}__client-result`)
    const actionButton = page.getByTestId(`${instanceId}__action-button`)

    await expect(clientResult).toHaveText('Initial Client State')
    await actionButton.click()
    await expect(clientResult).toHaveText('Client Action Performed')
  })

  test('Plugin State Mutation: should verify global context mutation propagation', async ({ page }) => {
    await page.goto('/plugins/mutation-test/')
    await waitForHydration(page)

    const comp = page.locator('mutation-test-component')
    const instanceId = await comp.getAttribute('data-cid')

    const serverResult = page.getByTestId(`${instanceId}__server-result`)
    await expect(serverResult).toHaveText('Server Data from DB')

    const clientResult = page.getByTestId(`${instanceId}__client-result`)
    const actionButton = page.getByTestId(`${instanceId}__action-button`)

    await expect(clientResult).toHaveText('Initial Client State')
    await actionButton.click()
    await expect(clientResult).toHaveText('Client Action Performed')
  })
})
