import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Home page/);
});

test('has compiled coralite-header custom element', async ({ page }) => {
  await page.goto('/');

  // Check if the custom coralite-header element exists and contains the expected text
  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - text: Hello
    - banner: This is the mighty header
    - text: world
  `);
});
