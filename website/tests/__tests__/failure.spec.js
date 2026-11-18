import { test, expect } from '../fixtures.js'

test('homepage explains the fail-closed diagnostic loop', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: 'The build is the first test.' })).toBeVisible()

  const demo = page.locator('.failure-demo')
  await expect(demo).toContainText('CORALITE-E201')
  await expect(demo).toContainText('src/pages/index.html:42:18')
  await expect(demo).toContainText('Suggested 1-Shot Fix')
  await expect(demo).toContainText('exit code 1')

  await expect(page.locator('.failure-copy ui-link')).toHaveAttribute('href', '/docs/guide/validation')
})

test('compare and why surface failure discovery', async ({ page }) => {
  await page.goto('/compare')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('cell', { name: 'Failure Discovery' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Diagnostics' })).toBeVisible()
  await expect(page.getByText('Compile-time, fail-closed')).toBeVisible()

  await page.goto('/why')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Invalid templates, broken component contracts, and server imports cannot compile.')).toBeVisible()
  await expect(page.locator('.manifesto-content a[href="/docs/guide/validation"]')).toBeVisible()
})
