import { test, expect } from '@playwright/test'
import { waitForHydration } from '../helpers.js'

test.describe('Flat page exports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flat-page/')
    await waitForHydration(page)
  })

  test('renders server state and getters', async ({ page }) => {
    await expect(page.getByTestId('flat-title')).toHaveText('Flat Page')
    await expect(page.getByTestId('flat-summary')).toHaveText('Summary: Flat Page')
    await expect(page.getByTestId('flat-increment')).toHaveText('count: 0')
  })

  test('runs the page client and updates page tokens', async ({ page }) => {
    const button = page.getByTestId('flat-increment')
    const output = page.getByTestId('flat-client')

    await expect(output).toBeVisible()
    await expect(output).toHaveText('client ready')

    await button.click()
    await expect(button).toHaveText('count: 1')
    await expect(page.locator('body')).toHaveAttribute('data-count-label', 'count: 1')
    await expect(output).toHaveText('client count: 1')

    await button.click()
    await expect(button).toHaveText('count: 2')
    await expect(page.locator('body')).toHaveAttribute('data-count-label', 'count: 2')
    await expect(output).toHaveText('client count: 2')
  })

  test('updates page tokens on the html element', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await page.getByTestId('flat-lang').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')

    await page.getByTestId('flat-lang').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('enumerates dynamic paths from flat paths()', async ({ page }) => {
    await page.goto('/flat-dynamic/one/')
    await waitForHydration(page)
    await expect(page.getByTestId('flat-dynamic-title')).toHaveText('Flat one')

    await page.goto('/flat-dynamic/two/')
    await waitForHydration(page)
    await expect(page.getByTestId('flat-dynamic-title')).toHaveText('Flat two')
  })
})
