import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('InnerHTML Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/innerhtml-test/')
    await waitForHydration(page)
  })

  test('should create components via innerHTML, outerHTML and insertAdjacentHTML', async ({ page }) => {
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
  })
})
