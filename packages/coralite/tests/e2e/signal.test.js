import { test, expect } from '@playwright/test'

test.describe('AbortSignal Runtime Lifecycle', () => {
  test('should provide a signal that aborts on unmount and refreshes on remount', async ({ page }) => {
    await page.goto('/signal-test.html')

    await page.evaluate(() => window.__coralite_ready__)

    const mountBtn = page.getByRole('button', {
      name: 'Mount',
      exact: true
    })
    const unmountBtn = page.getByRole('button', {
      name: 'Unmount',
      exact: true
    })
    const childComponent = page.locator('signal-test-child')

    await expect(childComponent).toHaveCount(0)

    await mountBtn.click()
    await expect(childComponent).toHaveCount(1)

    await expect(childComponent.locator('div')).toHaveText('Active')

    let abortCount = await page.evaluate(() => window.abortCount || 0)
    expect(abortCount).toBe(0)

    await unmountBtn.click()
    await expect(childComponent).toHaveCount(0)

    abortCount = await page.evaluate(() => window.abortCount)
    expect(abortCount).toBe(1)

    await mountBtn.click()
    await expect(childComponent).toHaveCount(1)
    await expect(childComponent.locator('div')).toHaveText('Active')

    await unmountBtn.click()

    abortCount = await page.evaluate(() => window.abortCount)
    expect(abortCount).toBe(2)
  })

  test('should provide signal to plugin helpers', async ({ page }) => {
    await page.goto('/signal-test.html')

    await page.evaluate(() => window.__coralite_ready__)

    const mountBtn = page.getByRole('button', {
      name: 'Mount Plugin',
      exact: true
    })
    const unmountBtn = page.getByRole('button', {
      name: 'Unmount Plugin',
      exact: true
    })
    const childComponent = page.locator('signal-plugin-child')

    await expect(childComponent).toHaveCount(0)

    await mountBtn.click()
    await expect(childComponent).toHaveCount(1)

    await unmountBtn.click()
    await expect(childComponent).toHaveCount(0)

    let abortCount = await page.evaluate(() => window.pluginAbortCount)
    expect(abortCount).toBe(1)
  })
})
