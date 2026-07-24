/**
 * Waits for the Coralite hydration process to complete.
 * Supports both development/testing modes (using window.__coralite__) and production mode (using data-coralite-ready).
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 */
export async function waitForHydration (page) {
  await page.waitForFunction(() => {
    if (document.documentElement.getAttribute('data-coralite-ready') === 'true') {
      return true
    }
    return window.__coralite__ && window.__coralite__.lifecycle !== undefined
  })
  await page.evaluate(() => {
    if (document.documentElement.getAttribute('data-coralite-ready') === 'true') {
      return true
    }
    return window.__coralite__.lifecycle.hydrated
  })
}
