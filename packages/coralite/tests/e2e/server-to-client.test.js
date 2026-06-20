import { test, expect } from '@playwright/test'

test.describe('Server to Client State Propagation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/server-to-client.html')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('SSR Instance: should have server values in state and getters', async ({ page }) => {
    const ssrComp = page.locator('server-to-client-comp').first()

    await expect(ssrComp.locator('[data-testid="server-val"]')).toHaveText('from-server')
    await expect(ssrComp.locator('[data-testid="getter-val"]')).toHaveText('getter-from-server')
    await expect(ssrComp.locator('[data-testid="attr-val"]')).toHaveText('overwritten-by-server')

    await ssrComp.locator('#check-state').click()
    const stateText = await ssrComp.locator('[data-testid="client-state"]').textContent()
    const state = JSON.parse(stateText)

    expect(state.serverVal).toBe('from-server')
    expect(state.attrVal).toBe('overwritten-by-server')
    expect(state.getterVal).toBe('getter-from-server')
    expect(state.unusedVal).toBe('not-in-client-code')
  })

  test('Imperative Instance: should have server values from base evaluation', async ({ page }) => {
    const imperativeComp = page.locator('server-to-client-comp').nth(1)

    // Wait for it to be ready/hydrated
    await expect(imperativeComp).toHaveAttribute('data-cid')

    await expect(imperativeComp.locator('[data-testid="server-val"]')).toHaveText('from-server')
    await expect(imperativeComp.locator('[data-testid="getter-val"]')).toHaveText('getter-from-server')
    await expect(imperativeComp.locator('[data-testid="attr-val"]')).toHaveText('overwritten-by-server')

    await imperativeComp.locator('#check-state').click()
    const stateText = await imperativeComp.locator('[data-testid="client-state"]').textContent()
    const state = JSON.parse(stateText)

    expect(state.serverVal).toBe('from-server')
    expect(state.attrVal).toBe('overwritten-by-server')
    expect(state.getterVal).toBe('getter-from-server')
    expect(state.unusedVal).toBe('not-in-client-code')
  })
})
