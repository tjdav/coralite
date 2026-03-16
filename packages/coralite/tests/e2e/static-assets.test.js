import { test, expect } from '@playwright/test'

test.describe('Static Assets', () => {
  test('should copy and serve static asset correctly', async ({ page }) => {
    // The asset was configured via CLI using: -a 'esbuild:package.json:esbuild.json'
    const response = await page.request.get('/esbuild.json')

    expect(response.status()).toBe(200)

    const data = await response.json()

    // Verify it is indeed the esbuild package.json
    expect(data.name).toBe('esbuild')
  })

  test('should copy asset configured with explicit src property', async ({ page }) => {
    // The asset was configured via coralite.config.js with { src: 'package.json', dest: 'coralite.json' }
    const response = await page.request.get('/coralite.json')

    expect(response.status()).toBe(200)

    const data = await response.json()

    // Verify it is indeed the coralite package.json
    expect(data.name).toBe('coralite')
  })
})
