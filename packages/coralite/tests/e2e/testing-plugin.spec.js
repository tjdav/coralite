import { test, expect } from '@playwright/test'

test.describe('Testing Plugin and Deterministic Counters', () => {
  test('should generate predictable data-testid attributes scoped to the component instance for declarative elements', async ({ page }) => {
    await page.goto('/testing-page.html')

    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)

    // Find all the test-container custom elements since testing-counter doesn't get preserved in DOM by playwright as an element if declarative
    const elements = await page.locator('.test-container').all()
    expect(elements.length).toBe(2)

    // Check first instance (index 0)
    const firstInstance = elements[0]
    await expect(firstInstance).toHaveAttribute('data-testid', 'testing-counter__container-0')
    await expect(firstInstance.locator('h1')).toHaveAttribute('data-testid', 'testing-counter__heading-0')
    await expect(firstInstance.locator('button')).toHaveAttribute('data-testid', 'testing-counter__btn-0')

    // Check second instance (index 1)
    const secondInstance = elements[1]
    await expect(secondInstance).toHaveAttribute('data-testid', 'testing-counter__container-1')
    await expect(secondInstance.locator('h1')).toHaveAttribute('data-testid', 'testing-counter__heading-1')
    await expect(secondInstance.locator('button')).toHaveAttribute('data-testid', 'testing-counter__btn-1')
  })

  test('should generate predictable data-testid attributes scoped to the component instance for imperative elements', async ({ page }) => {
    await page.goto('/testing-page.html')

    // @ts-ignore
    await page.evaluate(() => window.__coralite_ready__)

    // Wait for the imperative web components to mount
    await page.waitForSelector('testing-counter-imperative')
    const elements = await page.locator('testing-counter-imperative').all()
    expect(elements.length).toBe(2)

    // Check first instance (index 0)
    const firstInstance = elements[0]
    await expect(firstInstance.locator('div')).toHaveAttribute('data-testid', 'testing-counter-imperative__container-0')
    await expect(firstInstance.locator('h1')).toHaveAttribute('data-testid', 'testing-counter-imperative__heading-0')
    await expect(firstInstance.locator('button')).toHaveAttribute('data-testid', 'testing-counter-imperative__btn-0')

    // Check second instance (index 1)
    const secondInstance = elements[1]
    await expect(secondInstance.locator('div')).toHaveAttribute('data-testid', 'testing-counter-imperative__container-1')
    await expect(secondInstance.locator('h1')).toHaveAttribute('data-testid', 'testing-counter-imperative__heading-1')
    await expect(secondInstance.locator('button')).toHaveAttribute('data-testid', 'testing-counter-imperative__btn-1')
  })
})
