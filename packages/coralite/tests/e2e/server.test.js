import { test, expect } from '@playwright/test'

test.describe('Server State and State Propagation', () => {
  test('SSR Instance: should render server state and handle attribute propagation', async ({ page }) => {
    await page.goto('/server-state/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)

    const title = page.getByTestId('server-props-component-0__title')
    await expect(title).toHaveText('Server Properties Title')

    const filePath = page.getByTestId('server-props-component-0__filePath')
    await expect(filePath).toContainText('tests/fixtures/pages/server-state')

    const serverData = page.getByTestId('server-props-component-0__serverData')
    await expect(serverData).toHaveText('FileExists')

    const metaLang = page.getByTestId('server-props-component-0__metaLang')
    await expect(metaLang).toHaveText('en')
  })

  test('Attribute Overwriting: should have server values in state and getters', async ({ page }) => {
    await page.goto('/server-to-client/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)

    const ssrComp = page.locator('server-to-client-comp').first()
    const instanceId = await ssrComp.getAttribute('data-cid')

    const serverVal = ssrComp.getByTestId(`${instanceId}__server-val`)
    const getterVal = ssrComp.getByTestId(`${instanceId}__getter-val`)
    const attrValDisplay = ssrComp.getByTestId(`${instanceId}__attr-val-display`)
    const checkBtn = ssrComp.getByTestId(`${instanceId}__check-state`)
    const clientState = ssrComp.getByTestId(`${instanceId}__client-state`)

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
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)

    const parent = page.locator('server-to-client-parent')
    const impComp = parent.locator('server-to-client-comp')

    await expect(impComp).toHaveAttribute('data-cid')
    const instanceId = await impComp.getAttribute('data-cid')

    const serverVal = impComp.getByTestId(`${instanceId}__server-val`)
    const getterVal = impComp.getByTestId(`${instanceId}__getter-val`)
    const attrValDisplay = impComp.getByTestId(`${instanceId}__attr-val-display`)
    const checkBtn = impComp.getByTestId(`${instanceId}__check-state`)
    const clientState = impComp.getByTestId(`${instanceId}__client-state`)

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
