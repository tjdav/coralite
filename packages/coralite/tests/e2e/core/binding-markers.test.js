import { test, expect } from '@playwright/test'
import { waitForHydration } from '../helpers.js'

test.describe('binding marker slot collision', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/binding-markers/')
    await waitForHydration(page)
  })

  test('resolves parent bindings before a named slot with a custom child', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', error => {
      pageErrors.push(error.message)
    })

    const parent = page.getByTestId('parent-custom')
    const toggle = parent.getByTestId('toggle')
    const status = parent.getByTestId('status')
    const child = parent.locator('marker-slot-child')

    await expect(parent).toHaveAttribute('data-parent-ready', '')
    await expect(child).toHaveAttribute('data-child-ready', '')

    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(toggle).toHaveText('off')
    await expect(status).toHaveJSProperty('hidden', true)
    await expect(status).toHaveText('idle')

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveText('on')
    await expect(status).toHaveJSProperty('hidden', false)
    await expect(status).toHaveText('active')

    await child.getByTestId('child-action').click()
    await expect(child).toHaveAttribute('data-child-clicked', '')

    expect(pageErrors).toEqual([])
  })

  test('resolves parent bindings with plain slotted markup', async ({ page }) => {
    const parent = page.getByTestId('parent-plain')
    const toggle = parent.getByTestId('toggle')
    const status = parent.getByTestId('status')

    await expect(parent.getByTestId('plain-slot')).toHaveText('plain')

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveText('on')
    await expect(status).toHaveJSProperty('hidden', false)
    await expect(status).toHaveText('active')
  })

  test('resolves parent bindings when the slot is empty', async ({ page }) => {
    const parent = page.getByTestId('parent-empty')
    const toggle = parent.getByTestId('toggle')
    const status = parent.getByTestId('status')

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveText('on')
    await expect(status).toHaveJSProperty('hidden', false)
    await expect(status).toHaveText('active')
  })

  test('dynamically appended slotted content still updates parent bindings', async ({ page }) => {
    const parent = page.getByTestId('parent-custom')
    const toggle = parent.getByTestId('toggle')
    const status = parent.getByTestId('status')

    await page.evaluate(() => {
      const host = document.querySelector('#marker-custom')
      const child = document.createElement('marker-slot-child')
      child.setAttribute('slot', 'extra')
      child.setAttribute('data-dynamic-child', '')
      host.appendChild(child)
    })

    await expect(parent.locator('marker-slot-child[data-dynamic-child]')).toHaveAttribute('data-child-ready', '')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(toggle).toHaveText('on')
    await expect(status).toHaveJSProperty('hidden', false)
    await expect(status).toHaveText('active')
  })
})
