import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Slots Projection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slots-projection/')
    await waitForHydration(page)
  })

  test('should render fallback content when slot is empty', async ({ page }) => {
    const fallbackTest = page.locator('#fallback-test')
    await expect(fallbackTest).toContainText('Fallback Content')
  })

  test('should transform slot content if transformation returns string', async ({ page }) => {
    const transformTest = page.locator('#transform-test')
    await expect(transformTest).toContainText('Transformed: Transform Me')
  })

  test('should preserve original nodes and state when transformation returns void', async ({ page }) => {
    const preserveTest = page.locator('#preserve-test')
    const btn = preserveTest.locator('button')

    await expect(btn).toHaveText('Unchanged')
    await btn.click()
    await expect(btn).toHaveText('Clicked')
  })

  test('should successfully resolve nested refs within slot projections of custom components', async ({ page }, testInfo) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()))
    page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message))
    // In production mode, data-testid is stripped, so we use standard tag/class/structure querying
    const isProduction = testInfo.project.name.includes('-prod')

    const container = page.locator('#slot-nested-test')
    const input = isProduction ? container.locator('input') : page.getByTestId(/slot-test-container-\d+__search-bar/)
    const button = isProduction ? container.locator('button') : page.getByTestId(/slot-test-container-\d+__cancel-button/)
    const status = isProduction ? container.locator('.test-container > div').last() : page.getByTestId(/slot-test-container-\d+__status-output/)

    // Confirm initial state is rendered and hydrated
    await expect(status).toHaveText('Idle')

    // Click cancel button to trigger event listener registered via refs('btnCancel')
    await button.click()
    await expect(status).toHaveText('Cancelled')

    // Fill search bar to trigger event listener registered via refs('searchBar')
    await input.fill('Atoll Search Query')
    await expect(status).toHaveText('Searching: Atoll Search Query')
  })

  test('should preserve reactivity and component boundaries on template token interpolations within nested slot projections', async ({ page }) => {
    const container = page.locator('#lost-reactivity-test')
    const textSpan = container.locator('.target-span')
    const button = container.locator('.change-btn')

    // 1. Initially should display 'Edit'
    await expect(textSpan).toHaveText('Edit')

    // 2. Click button to trigger parent state change
    await button.click()

    // 3. Reactively updates inside the slot to 'Save'
    await expect(textSpan).toHaveText('Save')

    // 4. Assert component boundary is fully intact (i.e. child container hasn't been destroyed or overwritten)
    const childContainer = container.locator('.child-container')
    await expect(childContainer).toBeVisible()
  })
})
