import { test, expect } from '@playwright/test'

test.describe('Client Script', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/client-script/')
    await page.waitForFunction('window.__coralite_ready__ !== undefined', undefined, { timeout: 2000 }).catch(() => {
    })
    if (await page.evaluate(() => window.__coralite_ready__ !== undefined)) {
      await page.evaluate(() => window.__coralite_ready__)
    }
  })

  test('should execute script, setup context, and test reactivity', async ({ page }) => {
    // Because it is mounted imperatively via script rather than statically built into the DOM by the server,
    // it will not have the build-time data-testid injection, but we can query by the `ref` itself
    // or by the root data-testid of the host if needed, actually refs inside it will generate dynamic ids at runtime
    // based on `this.componentId + '__' + refName + '-' + this._index`. For an imperative component it should be
    // client-script-component__titleDisplay-0. Wait, the testing plugin does not duplicate dynamic refs into data-testid
    // for components created purely on the client after build time!
    // The test framework should just find elements by standard locator for dynamic web components if testids aren't generated.
    // Or we can rely on Playwright's general selectors.

    // We can select the host we assigned a testid to:
    const host = page.getByTestId('mounted-child')
    const title = host.locator('h2')
    await expect(title).toHaveText('Initial Parent')

    const status = host.locator('p')
    await expect(status).toHaveText('Status: Offline')

    const btn = host.locator('button')
    await btn.click()

    await expect(title).toHaveText('Updated')
    await expect(status).toHaveText('Status: Online')

    await expect(host).toHaveAttribute('data-confetti', 'loaded')
  })
})
