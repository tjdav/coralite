import { waitForHydration, isProduction } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Imperative Components - Basic Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/imperative-components/')
    await waitForHydration(page)
  })

  test('should create component imperatively and assign non-serializable objects', async ({ page }) => {
    const comp = page.locator('imperative-child').first()
    const title = comp.locator('h2')
    await expect(title).toHaveText('Imperative Mount')

    const dataDisplay = comp.locator('p')
    await expect(dataDisplay).toHaveText('A,B,C')
  })

  test('should prefix data-testid inside imperatively created child element', async ({ page }, testInfo) => {
    if (isProduction(testInfo)) {
      // In production, all data-testid attributes should be stripped
      await expect(page.locator('[data-testid]')).toHaveCount(0)
    } else {
      // In non-production, the child component should have its data-testid attributes prefixed with its instance ID.
      const childTitle = page.getByTestId(/imperative-child-\d+__title/)
      await expect(childTitle).toBeVisible()
      await expect(childTitle).toHaveText('Imperative Mount')

      const childDisplay = page.getByTestId(/imperative-child-\d+__dataDisplay/)
      await expect(childDisplay).toBeVisible()
      await expect(childDisplay).toHaveText('A,B,C')
    }
  })
})

test.describe('Imperative Components - Nested Instances', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nested-imperative/')
    await waitForHydration(page)
  })

  test('should load nested components in an imperatively created component', async ({ page }) => {
    // Ensure the parent container rendered
    const parent = page.locator('nested-parent')
    await expect(parent).toBeVisible()

    // Ensure the imperatively appended layout mounted successfully
    const layout = parent.locator('nested-layout')
    await expect(layout).toBeVisible()

    const heading = layout.locator('h1')
    await expect(heading).toHaveText('Nested Layout')

    const button = layout.locator('.btn')

    await expect(button).toBeVisible()
    await expect(button).toHaveText('Click Me')

    // Verify imperative interactivity still works
    await button.click()
    await expect(button).toHaveText('Clicked')
  })
})

test.describe('Imperative Components - Deep Recursive Nesting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/deep-nested-imperative/')
    await waitForHydration(page)
  })

  test('should load recursively nested imperative components', async ({ page }) => {
    const parent = page.locator('deep-parent')
    await expect(parent).toBeVisible()

    const level1 = parent.locator('deep-level-1[depth="1"]')
    await expect(level1).toBeVisible()
    await expect(level1.locator('> .container > .label')).toHaveText('Level 1')

    const level2 = level1.locator('deep-level-1[depth="2"]')
    await expect(level2).toBeVisible()
    await expect(level2.locator('> .container > .label')).toHaveText('Level 2')

    const level3 = level2.locator('deep-level-1[depth="3"]')
    await expect(level3).toBeVisible()
    await expect(level3.locator('> .container > .label')).toHaveText('Level 3')

    // Level 4 should NOT exist
    const level4 = level3.locator('deep-level-1[depth="4"]')
    await expect(level4).not.toBeAttached()
  })
})

test.describe('Imperative Components - Getter Tokens', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/getter-token/')
    await waitForHydration(page)
  })

  test('should display getter value as token in imperative component', async ({ page }) => {
    const comp = page.locator('getter-child').first()
    const status = comp.locator('p')
    await expect(status).toHaveText('Seen')
  })
})
