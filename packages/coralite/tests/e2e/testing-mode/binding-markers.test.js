import { test, expect } from '@playwright/test'
import { waitForHydration } from '../helpers.js'

test.describe('binding marker slot collision (testing mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/binding-markers/')
    await waitForHydration(page)
  })

  test('updates parent bindings with a custom child in a named slot', async ({ page }) => {
    const parent = page.getByTestId('parent-custom')
    const toggle = parent.getByTestId('toggle')
    const status = parent.getByTestId('status')
    const child = parent.locator('marker-slot-child')

    await expect(parent).toHaveAttribute('data-parent-ready', '')
    await expect(child).toHaveAttribute('data-child-ready', '')

    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(toggle).toHaveText('off')
    await expect(status).toHaveJSProperty('hidden', true)

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveText('on')
    await expect(status).toHaveJSProperty('hidden', false)
    await expect(status).toHaveText('active')

    await child.getByTestId('child-action').click()
    await expect(child).toHaveAttribute('data-child-clicked', '')
  })

  test('updates parent bindings with plain slotted markup', async ({ page }) => {
    const parent = page.getByTestId('parent-plain')
    const toggle = parent.getByTestId('toggle')
    const status = parent.getByTestId('status')

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveText('on')
    await expect(status).toHaveJSProperty('hidden', false)
    await expect(status).toHaveText('active')
  })
})
