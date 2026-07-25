/**
 * Waits for the Coralite hydration process to complete.
 * Supports both development/testing modes (using window.__coralite__) and production mode (using data-coralite-ready).
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 */
export async function waitForHydration (page) {
  await page.waitForFunction(() => {
    return (window.__coralite__ && window.__coralite__.lifecycle !== undefined) ||
      document.documentElement.getAttribute('data-coralite-ready') === 'true'
  })
  await page.evaluate(async () => {
    if (window.__coralite__ && window.__coralite__.lifecycle !== undefined) {
      return window.__coralite__.lifecycle.hydrated
    }
    return true
  })
}
