import { test, expect } from '@playwright/test'

test.describe('Server Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/server-properties/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  test('should render server properties and inject environment', async ({ page }) => {
    const title = page.getByTestId('title')
    await expect(title).toHaveText('Server Properties Title')

    const filePath = page.getByTestId('file-path')
    const filePathText = await filePath.textContent()
    expect(filePathText).toContain('tests/fixtures/pages/server-properties')

    const serverData = page.getByTestId('server-data')
    await expect(serverData).toHaveText('FileExists')

    const metaLang = page.getByTestId('meta-lang')
    await expect(metaLang).toHaveText('en')
  })
})
