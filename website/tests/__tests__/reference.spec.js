import { test, expect } from '../fixtures.js'

test('reference page visual test', async ({ page }) => {
  await page.goto('/reference/attributes')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference.png', {
    fullPage: true
  })
})

test('client reference page visual test', async ({ page }) => {
  await page.goto('/reference/client')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-client.png', {
    fullPage: true
  })
})

test('getters reference page visual test', async ({ page }) => {
  await page.goto('/reference/getters')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-getters.png', {
    fullPage: true
  })
})

test('style reference page visual test', async ({ page }) => {
  await page.goto('/reference/style')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-style.png', {
    fullPage: true
  })
})

test('formControl reference page visual test', async ({ page }) => {
  await page.goto('/reference/form-control')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-form-control.png', {
    fullPage: true
  })
})

test('slots reference page visual test', async ({ page }) => {
  await page.goto('/reference/slots')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-slots.png', {
    fullPage: true
  })
})

test('page api reference page visual test', async ({ page }) => {
  await page.goto('/reference/page-api')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-page-api.png', {
    fullPage: true
  })
})

test('plugins reference page visual test', async ({ page }) => {
  await page.goto('/reference/plugins')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-plugins.png', {
    fullPage: true
  })
})

test('server reference page visual test', async ({ page }) => {
  await page.goto('/reference/server')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-server.png', {
    fullPage: true
  })
})

test('cli reference page visual test', async ({ page }) => {
  await page.goto('/reference/cli')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-cli.png', {
    fullPage: true
  })
})

test('reference index visual test', async ({ page }) => {
  await page.goto('/reference/')

  await page.waitForLoadState('networkidle')

  await expect(page).toHaveScreenshot('reference-index.png', {
    fullPage: true
  })
})
