import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('InnerHTML Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/innerhtml-test/')
    await waitForHydration(page)
  })

  test('should create components via innerHTML, outerHTML and insertAdjacentHTML', async ({ page }) => {
    // Note: InnerHTML and OuterHTML are technically antipatterns for creating Coralite components
    // as per AGENTS.md / llms.txt, but they are supported for legacy or specific cases.
    // The test verifies they still work.

    const children = page.locator('innerhtml-child')
    await expect(children).toHaveCount(3)

    const child1 = children.nth(0)
    await expect(child1).toHaveAttribute('data-cid')
    const id1 = await child1.getAttribute('data-cid')
    await expect(page.getByTestId(`${id1}__title`)).toHaveText('InnerHTML Mount')

    const child2 = children.nth(1)
    await expect(child2).toHaveAttribute('data-cid')
    const id2 = await child2.getAttribute('data-cid')
    await expect(page.getByTestId(`${id2}__title`)).toHaveText('OuterHTML Mount')

    const child3 = children.nth(2)
    await expect(child3).toHaveAttribute('data-cid')
    const id3 = await child3.getAttribute('data-cid')
    await expect(page.getByTestId(`${id3}__title`)).toHaveText('AdjacentHTML Mount')
  })
})
