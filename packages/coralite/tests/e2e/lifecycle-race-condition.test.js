import { test, expect } from '@playwright/test'

test.describe('Lifecycle Race Condition', () => {
  test('should not throw TypeError when nested declarative custom elements load during async parent lifecycle', async ({ page }) => {
    let errors = []
    page.on('pageerror', err => {
      errors.push(err.message)
    })

    await page.goto('/lifecycle-bug.html')
    await page.evaluate(() => window.__coralite_ready__)

    const childStatus = await page.evaluate(() => window.__child_status)
    const childError = await page.evaluate(() => window.__child_error)

    expect(errors.length).toBe(0)
    expect(childError).toBeUndefined()
    expect(childStatus).toBe('SUCCESS')
  })
})
