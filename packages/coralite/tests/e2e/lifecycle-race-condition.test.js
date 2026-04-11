import { test, expect } from '@playwright/test'

test.describe('Lifecycle Race Condition', () => {
  test('should not throw TypeError when nested declarative custom elements load during async parent lifecycle', async ({ page }) => {
    let errors = []
    page.on('pageerror', err => {
      errors.push(err.message)
    })

    await page.goto('http://localhost:3000/lifecycle-bug.html')

    const result = await page.evaluate(() => window.__test_done)

    expect(errors.length).toBe(0)
    expect(result).toBe('SUCCESS')
  })
})
