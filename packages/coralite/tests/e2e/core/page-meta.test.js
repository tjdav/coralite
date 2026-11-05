import { test, expect } from '@playwright/test'
import { waitForHydration } from '../helpers.js'

test.describe('Page meta declarations', () => {
  test('renders meta defaults as page state without a server block', async ({ page }) => {
    await page.goto('/page-meta/')
    await waitForHydration(page)

    await expect(page.getByTestId('meta-title')).toHaveText('Default title')
    await expect(page.getByTestId('meta-description')).toHaveText('Default description')
    await expect(page.getByTestId('meta-count')).toHaveText('3')
    await expect(page.getByTestId('meta-campaign')).toHaveText('organic')
  })

  test('keeps literal head metadata authoritative and fills missing keys from meta', async ({ page }) => {
    await page.goto('/page-meta/')
    await waitForHydration(page)

    await expect(page.getByTestId('meta-doc-title')).toHaveText('Literal title')
    await expect(page.getByTestId('meta-doc-description')).toHaveText('Literal description')
    await expect(page.getByTestId('meta-doc-lang')).toHaveText('en')
    await expect(page.getByTestId('meta-doc-campaign')).toHaveText('organic')
  })

  test('updates page state from client code', async ({ page }) => {
    await page.goto('/page-meta/')
    await waitForHydration(page)

    await page.getByTestId('meta-bump').click()
    await expect(page.getByTestId('meta-count')).toHaveText('4')
  })

  test('passes meta defaults to server and lets server override state', async ({ page }) => {
    await page.goto('/page-meta-server/')
    await waitForHydration(page)

    await expect(page.getByTestId('meta-server-title')).toHaveText('Default title from server')
    await expect(page.getByTestId('meta-server-count')).toHaveText('2')
    await expect(page.getByTestId('meta-server-derived')).toHaveText('20')
    await expect(page.getByTestId('meta-server-doc-title')).toHaveText('Server literal title')
  })
})
