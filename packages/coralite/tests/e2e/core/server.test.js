import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Server State and State Propagation', () => {
  test('SSR Instance: should render server state and handle attribute propagation', async ({ page }) => {
    await page.goto('/server-state/')
    await waitForHydration(page)

    const comp = page.locator('server-props-component').first()
    const title = comp.locator('h2')
    await expect(title).toHaveText('Server Properties Title')

    const filePath = comp.locator('p').nth(0)
    await expect(filePath).toContainText('tests/fixtures/pages/server-state')

    const serverData = comp.locator('p').nth(1)
    await expect(serverData).toHaveText('FileExists')

    const metaLang = comp.locator('p').nth(2)
    await expect(metaLang).toHaveText('en')
  })

  test('Attribute Overwriting: should have server values in state and getters', async ({ page }) => {
    await page.goto('/server-to-client/')
    await waitForHydration(page)

    const ssrComp = page.locator('server-to-client-comp').first()

    const serverVal = ssrComp.locator('div').nth(0)
    const getterVal = ssrComp.locator('div').nth(1)
    const attrValDisplay = ssrComp.locator('div').nth(2)
    const checkBtn = ssrComp.locator('button')
    const clientState = ssrComp.locator('div').nth(3)

    await expect(serverVal).toHaveText('from-server')
    await expect(getterVal).toHaveText('getter-from-server')
    await expect(attrValDisplay).toHaveText('overwritten-by-server')

    await checkBtn.click()
    const stateText = await clientState.textContent()
    const state = JSON.parse(stateText)

    expect(state.serverVal).toBe('from-server')
    expect(state.attrVal).toBe('overwritten-by-server')
    expect(state.getterVal).toBe('getter-from-server')
    expect(state.unusedVal).toBe('not-in-client-code')
  })

  test('Imperative Instance: should have server values from base evaluation', async ({ page }) => {
    await page.goto('/server-to-client/')
    await waitForHydration(page)

    const parent = page.locator('server-to-client-parent')
    const impComp = parent.locator('server-to-client-comp')

    await expect(impComp).toHaveAttribute('data-cid')

    const serverVal = impComp.locator('div').nth(0)
    const getterVal = impComp.locator('div').nth(1)
    const attrValDisplay = impComp.locator('div').nth(2)
    const checkBtn = impComp.locator('button')
    const clientState = impComp.locator('div').nth(3)

    await expect(serverVal).toHaveText('from-server')
    await expect(getterVal).toHaveText('getter-from-server')
    await expect(attrValDisplay).toHaveText('overwritten-by-server')

    await checkBtn.click()
    const stateText = await clientState.textContent()
    const state = JSON.parse(stateText)

    expect(state.serverVal).toBe('from-server')
    expect(state.attrVal).toBe('overwritten-by-server')
    expect(state.getterVal).toBe('getter-from-server')
    expect(state.unusedVal).toBe('not-in-client-code')
  })
})
