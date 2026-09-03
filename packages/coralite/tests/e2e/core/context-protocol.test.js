import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('W3C Web Components Context Protocol (provide / consume)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/context-protocol/')
    await waitForHydration(page)
    await page.locator('#provider-a[data-client-ready="true"]').waitFor()
    await page.locator('#provider-b[data-client-ready="true"]').waitFor()
    await page.locator('#child-1[data-client-ready="true"]').waitFor()
    await page.locator('#child-2[data-client-ready="true"]').waitFor()
  })

  test('Test 1: Initial SSR Hydration with zero layout mismatch', async ({ page }) => {
    const child1Theme = page.locator('#child-1 .theme-value')
    const child1Count = page.locator('#child-1 .count-value')
    const child2Theme = page.locator('#child-2 .theme-value')
    const child2Count = page.locator('#child-2 .count-value')
    const standaloneTheme = page.locator('#child-standalone .theme-value')
    const standaloneCount = page.locator('#child-standalone .count-value')

    await expect(child1Theme).toHaveText('dark')
    await expect(child1Count).toHaveText('0')

    await expect(child2Theme).toHaveText('light')
    await expect(child2Count).toHaveText('10')

    await expect(standaloneTheme).toHaveText('none')
    await expect(standaloneCount).toHaveText('-1')
  })

  test('Test 2: Live Real-Browser Reactivity', async ({ page }) => {
    const providerA = page.locator('#provider-a')
    const btnToggleTheme = providerA.locator('#btn-toggle-theme')
    const child1Theme = page.locator('#child-1 .theme-value')
    const child2Theme = page.locator('#child-2 .theme-value')

    await expect(child1Theme).toHaveText('dark')
    await expect(child2Theme).toHaveText('light')

    await btnToggleTheme.click()

    await expect(child1Theme).toHaveText('light')
    await expect(child2Theme).toHaveText('light')
  })

  test('Test 3: Counter Cascade', async ({ page }) => {
    const providerA = page.locator('#provider-a')
    const btnIncrement = providerA.locator('#btn-increment')
    const child1Count = page.locator('#child-1 .count-value')

    await expect(child1Count).toHaveText('0')

    await btnIncrement.click()
    await expect(child1Count).toHaveText('1')

    await btnIncrement.click()
    await expect(child1Count).toHaveText('2')
  })

  test('Test 4: Dynamic DOM Re-parenting', async ({ page }) => {
    const child1Theme = page.locator('#child-1 .theme-value')
    const child1Count = page.locator('#child-1 .count-value')
    const btnReparent = page.locator('#btn-reparent')

    await expect(child1Theme).toHaveText('dark')
    await expect(child1Count).toHaveText('0')

    await btnReparent.click()

    await expect(child1Theme).toHaveText('light')
    await expect(child1Count).toHaveText('10')
  })

  test('Test 5: Native W3C context-request Event Dispatch Interop', async ({ page }) => {
    const receivedValue = await page.evaluate(() => {
      return new Promise((resolve) => {
        const providerA = document.getElementById('provider-a')
        if (!providerA) {
          resolve(null)
          return
        }

        const event = new CustomEvent('context-request', {
          bubbles: true,
          composed: true,
          detail: {
            context: 'app-context',
            callback: (val) => {
              resolve(val)
            }
          }
        })

        providerA.dispatchEvent(event)
      })
    })

    expect(receivedValue).toEqual({
      theme: 'dark',
      count: 0
    })
  })
})
