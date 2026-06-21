import { test, expect } from '@playwright/test'

test.describe('Server to Client State Propagation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/server-to-client.html')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('SSR Instance: should have server values in state and getters', async ({ page }) => {
    // We target the SSR instance specifically by looking for it OUTSIDE of the parent component
    // In this test, it's the first 'server-to-client-comp' on the page.
    const ssrComp = page.locator('server-to-client-comp').first()
    const instanceId = await ssrComp.getAttribute('data-cid')

    // We use the instanceId to build the testid and then scope the search to the component itself
    // to avoid collisions with the template or other instances.
    const serverVal = ssrComp.getByTestId(`${instanceId}__server-val`)
    const getterVal = ssrComp.getByTestId(`${instanceId}__getter-val`)
    const attrVal = ssrComp.getByTestId(`${instanceId}__attr-val`)
    const checkBtn = ssrComp.getByTestId(`${instanceId}__check-state`)
    const clientState = ssrComp.getByTestId(`${instanceId}__client-state`)

    await expect(serverVal).toHaveText('from-server')
    await expect(getterVal).toHaveText('getter-from-server')
    await expect(attrVal).toHaveText('overwritten-by-server')

    await checkBtn.click()
    const stateText = await clientState.textContent()
    const state = JSON.parse(stateText)

    expect(state.serverVal).toBe('from-server')
    expect(state.attrVal).toBe('overwritten-by-server')
    expect(state.getterVal).toBe('getter-from-server')
    expect(state.unusedVal).toBe('not-in-client-code')
  })

  test('Imperative Instance: should have server values from base evaluation', async ({ page }) => {
    // The imperative instance is inside 'server-to-client-parent'
    const parent = page.locator('server-to-client-parent')
    const impComp = parent.locator('server-to-client-comp')

    await expect(impComp).toHaveAttribute('data-cid')
    const instanceId = await impComp.getAttribute('data-cid')

    const serverVal = impComp.getByTestId(`${instanceId}__server-val`)
    const getterVal = impComp.getByTestId(`${instanceId}__getter-val`)
    const attrVal = impComp.getByTestId(`${instanceId}__attr-val`)
    const checkBtn = impComp.getByTestId(`${instanceId}__check-state`)
    const clientState = impComp.getByTestId(`${instanceId}__client-state`)

    await expect(serverVal).toHaveText('from-server')
    await expect(getterVal).toHaveText('getter-from-server')
    await expect(attrVal).toHaveText('overwritten-by-server')

    await checkBtn.click()
    const stateText = await clientState.textContent()
    const state = JSON.parse(stateText)

    expect(state.serverVal).toBe('from-server')
    expect(state.attrVal).toBe('overwritten-by-server')
    expect(state.getterVal).toBe('getter-from-server')
    expect(state.unusedVal).toBe('not-in-client-code')
  })
})
