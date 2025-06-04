import { test, expect } from '@playwright/test'

test('has title', async ({ page }) => {
  await page.goto('/')

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Home page/)
})

test('has compiled coralite-header custom element', async ({ page }) => {
  await page.goto('/')

  // Check if the custom coralite-header element exists and contains the expected text
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - text: Hello
    - banner: This is the mighty header
    - text: world
  `)
})

test('has custom element with default slot', async ({ page }) => {
  await page.goto('/about.html')

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - text: test
  `)
})

test('has named slots within body', async ({ page }) => {
  await page.goto('/about.html')

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - heading "Title" [level=1]
    - text: test
    - contentinfo: Footer
  `)
})

test('computed slots has been successful', async ({ page }) => {
  await page.goto('/code.html')

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - code: <div> <!-- Multiline Comments --> <h1>code</h1> </div>
  `)
})

test('has nested component', async ({ page }) => {
  await page.goto('/nested-components.html')

  await expect(page.locator('html')).toMatchAriaSnapshot(`
    - document: 
      - banner:
        - text: This is the mighty header
        - banner: This is the mighty header
      - text: circle square
      - banner:
        - text: This is the mighty header
        - heading "Nested title" [level=1]
  `)
})

test('has cast names from local json file', async ({ page }) => {
  await page.goto('/cast.html')

  await expect(page.locator('html')).toMatchAriaSnapshot(`
    - document: 
      - text: Nemo,Squirt,Dory,Crush
  `)
})
