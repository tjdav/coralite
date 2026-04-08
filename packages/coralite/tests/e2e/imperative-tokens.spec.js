import { test, expect } from '@playwright/test'

test('imperative component tokens are passed correctly', async ({ page }) => {
  await page.goto('http://localhost:3000/imperative-tokens-test.html')

  const child = page.locator('imperative-tokens-child')
  await child.waitFor({ state: 'attached' })

  const output = child.locator('#test-output')
  await expect(output).toHaveText('hello world')
})
