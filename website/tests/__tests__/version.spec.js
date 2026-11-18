import { readFileSync } from 'node:fs'
import { test, expect } from '../fixtures.js'

const { version } = JSON.parse(
  readFileSync(new URL('../../../packages/coralite/package.json', import.meta.url), 'utf8')
)

test('header badge shows the coralite package version', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.desktop-actions ui-badge')).toHaveText(`v${version}`)
})
