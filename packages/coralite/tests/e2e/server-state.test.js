import { test, expect } from '@playwright/test'

test.describe('Server State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/server-state/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should render server state and inject environment', async ({ page }) => {
    const title = page.getByTestId('title')
    await expect(title).toHaveText('Server Properties Title')

    const filePath = page.getByTestId('file-path')
    await expect(filePath).toContainText('tests/fixtures/pages/server-state')

    const serverData = page.getByTestId('server-data')
    await expect(serverData).toHaveText('FileExists')

    const metaLang = page.getByTestId('meta-lang')
    await expect(metaLang).toHaveText('en')
  })
})
