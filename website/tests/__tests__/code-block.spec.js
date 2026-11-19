import { test, expect } from '../fixtures.js'

test('css code blocks are syntax highlighted', async ({ page }) => {
  await page.goto('/learn/05-native-css-scoping')
  await page.waitForLoadState('networkidle')

  const block = page.locator('code-block[language="css"]').first()
  await expect(block).toHaveCount(1)
  await expect(block.locator('code .code-selector-pseudo').first()).toHaveText(':host')
  await expect(block.locator('code .code-attribute').first()).toHaveCSS('color', 'rgb(167, 139, 250)')
  await expect(block.locator('code .code-number').first()).toHaveCSS('color', 'rgb(245, 158, 11)')
})

test('bash code blocks are syntax highlighted', async ({ page }) => {
  await page.goto('/reference/cli')
  await page.waitForLoadState('networkidle')

  const block = page.locator('code-block[language="bash"]').first()
  await expect(block.locator('code .code-comment').first()).toBeVisible()
  await expect(block.locator('code .code-built_in').first()).toBeVisible()
})
