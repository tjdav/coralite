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

test('has aggregate content', async ({ page }) => {
  await page.goto('/blog/index.html')

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - text: Hello
    - banner: This is the mighty header
    - heading "Post 1" [level=2]
    - text: Nemo
    - time: Wed, 8 Jan 25
    - img "Photo of a cat"
    - text: short description
    - banner: This is the mighty header
    - heading "Post 2" [level=2]
    - text: Nemo
    - time: Thu, 9 Jan 25
    - img "Photo of a dog"
    - text: short description
    - banner: This is the mighty header
    - text: world
  `)
})

test('has named slots', async ({ page }) => {
  await page.goto('/blog/index.html')

  const metaName = page.locator('meta[name="name"]');
  const metaDescription = page.locator('meta[name="description"]');
  const metaDefaultHello = page.locator('meta[name="default-hello"]');
  const metaDefaultWorld = page.locator('meta[name="default-world"]');

  // named slots
  await expect(metaName).toHaveAttribute('content', 'coralite')
  await expect(metaDescription).toHaveAttribute('content', 'look mum, no database!')
  // default slots
  await expect(metaDefaultHello).toHaveAttribute('content', 'hello')
  await expect(metaDefaultWorld).toHaveAttribute('content', 'world')
})

