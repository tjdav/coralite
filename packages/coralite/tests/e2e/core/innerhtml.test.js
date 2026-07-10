import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('InnerHTML Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/innerhtml-test/')
    await waitForHydration(page)
  })

  test('should create components via innerHTML, outerHTML and insertAdjacentHTML', async ({ page }, testInfo) => {
    const children = page.locator('innerhtml-child')
    await expect(children).toHaveCount(3)

    const child1 = children.nth(0)
    await expect(child1).toHaveAttribute('data-cid')
    await expect(child1.locator('h2')).toHaveText('InnerHTML Mount')

    const child2 = children.nth(1)
    await expect(child2).toHaveAttribute('data-cid')
    await expect(child2.locator('h2')).toHaveText('OuterHTML Mount')

    const child3 = children.nth(2)
    await expect(child3).toHaveAttribute('data-cid')
    await expect(child3.locator('h2')).toHaveText('AdjacentHTML Mount')

    const isProduction = testInfo.project.name.includes('-prod')
    if (isProduction) {
      // In production, data-testid should be stripped completely
      await expect(page.locator('[data-testid="plain-inner"]')).toHaveCount(0)
      await expect(page.locator('[data-testid$="plain-inner"]')).toHaveCount(0)
    } else {
      // In non-production, the innerHTML's data-testid must be prefixed with the parent instance ID
      const plainInner = page.getByTestId(/innerhtml-parent-\d+__plain-inner/)
      await expect(plainInner).toBeVisible()
      await expect(plainInner).toHaveText('Plain Inner')
    }
  })
})
