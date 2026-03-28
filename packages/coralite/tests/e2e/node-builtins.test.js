import { test, expect } from '@playwright/test'

test.describe('Node Built-ins Polyfill Plugin', () => {
  test('should successfully bundle and run a Node.js built-in module (events)', async ({ page }) => {
    // Navigate to the built-in node module test fixture
    await page.goto('/node-builtins.html')

    // Check if the component rendered and the custom script executed successfully using EventEmitter
    const outputElement = await page.locator('span.success')
    await expect(outputElement).toHaveText('pong')
    await expect(outputElement).toHaveClass(/success/)
  })
})
