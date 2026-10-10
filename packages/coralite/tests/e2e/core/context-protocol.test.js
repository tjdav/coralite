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

test.describe('W3C Web Components Context Protocol (Modern: Map, Symbol, Object, Property Mapping)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/context-protocol-modern/')
    await waitForHydration(page)
    await page.locator('#map-provider-a[data-client-ready="true"]').waitFor()
    await page.locator('#map-provider-b[data-client-ready="true"]').waitFor()
    await page.locator('#map-child-1[data-client-ready="true"]').waitFor()
    await page.locator('#map-child-2[data-client-ready="true"]').waitFor()
    await page.locator('#map-child-standalone[data-client-ready="true"]').waitFor()
  })

  test('Test 6: Modern SSR Hydration & Defaults with Zero Layout Mismatch', async ({ page }) => {
    const child1Theme = page.locator('#map-child-1 .map-theme-value')
    const child1User = page.locator('#map-child-1 .map-user-value')
    const child1Setting = page.locator('#map-child-1 .map-setting-value')

    await expect(child1Theme).toHaveText('dark')
    await expect(child1User).toHaveText('Alice')
    await expect(child1Setting).toHaveText('active-setting')

    const child2Theme = page.locator('#map-child-2 .map-theme-value')
    const child2User = page.locator('#map-child-2 .map-user-value')
    const child2Setting = page.locator('#map-child-2 .map-setting-value')

    await expect(child2Theme).toHaveText('light')
    await expect(child2User).toHaveText('Charlie')
    await expect(child2Setting).toHaveText('active-setting')

    const standaloneTheme = page.locator('#map-child-standalone .map-theme-value')
    const standaloneUser = page.locator('#map-child-standalone .map-user-value')
    const standaloneSetting = page.locator('#map-child-standalone .map-setting-value')

    await expect(standaloneTheme).toHaveText('none')
    await expect(standaloneUser).toHaveText('Guest')
    await expect(standaloneSetting).toHaveText('fallback-setting')

    const vanillaConsumer = page.locator('#vanilla-consumer')
    await expect(vanillaConsumer).toHaveText('dark')
  })

  test('Test 7: Live Reactivity with Map Provider & Symbol Token', async ({ page }) => {
    const providerA = page.locator('#map-provider-a')
    const btnToggle = providerA.locator('#btn-toggle-map-theme')
    const child1Theme = page.locator('#map-child-1 .map-theme-value')
    const vanillaConsumer = page.locator('#vanilla-consumer')
    const child2Theme = page.locator('#map-child-2 .map-theme-value')

    await expect(child1Theme).toHaveText('dark')
    await expect(vanillaConsumer).toHaveText('dark')
    await expect(child2Theme).toHaveText('light')

    await btnToggle.click()

    await expect(child1Theme).toHaveText('light')
    await expect(vanillaConsumer).toHaveText('light')
    await expect(child2Theme).toHaveText('light')
  })

  test('Test 8: Live Reactivity with Object Reference Context Token', async ({ page }) => {
    const providerA = page.locator('#map-provider-a')
    const btnChangeUser = providerA.locator('#btn-change-user')
    const child1User = page.locator('#map-child-1 .map-user-value')
    const child2User = page.locator('#map-child-2 .map-user-value')

    await expect(child1User).toHaveText('Alice')
    await expect(child2User).toHaveText('Charlie')

    await btnChangeUser.click()

    await expect(child1User).toHaveText('Bob')
    await expect(child2User).toHaveText('Charlie')
  })

  test('Test 9: Real-Browser ContextRequestEvent Handshake & One-Shot Execution', async ({ page }) => {
    const result = await page.evaluate(() => {
      const child1 = document.getElementById('map-child-1')
      const tokens = window.__context_test_tokens__
      const EventCtor = window.ContextRequestEvent

      let receivedValue = null
      let unsubscribeCalled = false

      const event = new EventCtor(tokens.themeSymbolToken, (val, unsubscribe) => {
        receivedValue = val
        if (typeof unsubscribe === 'function') {
          unsubscribeCalled = true
        }
      }, false)

      child1.dispatchEvent(event)
      return { receivedValue, unsubscribeCalled }
    })

    expect(result.receivedValue).toBe('dark')
    expect(result.unsubscribeCalled).toBe(false)
  })

  test('Test 10: Consumer Callback Error Isolation in Real Browser', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    // Register a crashing subscriber alongside a healthy subscriber
    const receivedFromHealthy = await page.evaluate(() => {
      window.__healthyReceived = []
      const child1 = document.getElementById('map-child-1')
      const tokens = window.__context_test_tokens__
      const EventCtor = window.ContextRequestEvent

      // 1. Crashing subscriber
      child1.dispatchEvent(new EventCtor(tokens.themeSymbolToken, (val) => {
        if (val === 'light') {
          throw new Error('Crashing subscriber failed')
        }
      }, true))

      // 2. Healthy subscriber
      child1.dispatchEvent(new EventCtor(tokens.themeSymbolToken, (val) => {
        window.__healthyReceived.push(val)
      }, true))

      return window.__healthyReceived
    })

    expect(receivedFromHealthy).toEqual(['dark'])

    // Trigger state change to 'light' to fire the crashing subscriber
    const providerA = page.locator('#map-provider-a')
    const btnToggle = providerA.locator('#btn-toggle-map-theme')
    await btnToggle.click()

    // Wait for the healthy subscriber to receive the updated value
    await expect.poll(async () => {
      return page.evaluate(() => window.__healthyReceived)
    }).toEqual(['dark', 'light'])

    // Assert Coralite element consumer updated
    await expect(page.locator('#map-child-1 .map-theme-value')).toHaveText('light')

    // Assert error surfaced to global window / pageerror via queueMicrotask
    expect(pageErrors.some(msg => msg.includes('Crashing subscriber failed'))).toBe(true)
  })

  test('Test 11: Dynamic DOM Re-parenting with Map Providers', async ({ page }) => {
    const child1Theme = page.locator('#map-child-1 .map-theme-value')
    const child1User = page.locator('#map-child-1 .map-user-value')
    const btnReparent = page.locator('#btn-reparent-map')

    await expect(child1Theme).toHaveText('dark')
    await expect(child1User).toHaveText('Alice')

    await btnReparent.click()

    await expect(child1Theme).toHaveText('light')
    await expect(child1User).toHaveText('Charlie')
  })
})
