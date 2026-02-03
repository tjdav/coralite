import { test, expect } from '@playwright/test'

test.describe('Component', () => {
  test.describe('Setup Function', () => {
    test('should resolve async data and pass values to client', async ({ page }) => {
      await page.goto('/script-setup.html')

      // First instance (default prop)
      const first = page.locator('.setup-async').first()
      const message1 = first.locator('span[data-coralite-ref="message"]')
      const prop1 = first.locator('span[data-coralite-ref="prop"]')
      const clientMsg1 = first.locator('span[data-coralite-ref="client-msg"]')

      await expect(message1).toHaveText('Resolved')
      await expect(prop1).toHaveText('default')
      await expect(clientMsg1).toHaveText('passed-to-client')

      // Second instance (custom prop)
      const second = page.locator('.setup-async').nth(1)
      const message2 = second.locator('span[data-coralite-ref="message"]')
      const prop2 = second.locator('span[data-coralite-ref="prop"]')
      const clientMsg2 = second.locator('span[data-coralite-ref="client-msg"]')

      await expect(message2).toHaveText('Resolved')
      await expect(prop2).toHaveText('custom')
      await expect(clientMsg2).toHaveText('passed-to-client')
    })
  })
})
