import { test, expect } from '@playwright/test'

test.describe('Imperative Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imperative-components/')
    // @ts-ignore
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('should create component imperatively and assign non-serializable objects', async ({ page }) => {
    const title = page.getByTestId(/imperative-child-0__title/)
    await expect(title).toHaveText('Imperative Mount')

    const dataDisplay = page.getByTestId(/imperative-child-0__dataDisplay/)
    await expect(dataDisplay).toHaveText('A,B,C')
  })
})
