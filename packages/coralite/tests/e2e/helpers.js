/**
 * Waits for the Coralite hydration process to complete.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 */
export async function waitForHydration (page) {
  await page.waitForFunction(() => window.__coralite__ && window.__coralite__.lifecycle !== undefined)
  await page.evaluate(() => window.__coralite__.lifecycle.hydrated)
}
