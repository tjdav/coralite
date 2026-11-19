import { test, expect } from '../fixtures.js'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('hero command copies its text to the clipboard', async ({ page }) => {
  await page.goto('/')

  const command = page.locator('.hero-content ui-command')
  const button = command.locator('button')

  await button.click()

  await expect(button).toHaveAttribute('data-copied', '')
  await expect(command.locator('[role="status"]')).toHaveText('Copied to clipboard')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('npm create coralite@latest')
})
