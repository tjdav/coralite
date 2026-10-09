import { test } from '@playwright/test'

/**
 * Checks if the current test run is executing in production mode.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object.
 * @returns {boolean}
 */
export function isProduction (testInfo) {
  return testInfo.project.name.includes('-prod')
}

/**
 * Checks if the current test run is executing in development mode.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object.
 * @returns {boolean}
 */
export function isDevelopment (testInfo) {
  return testInfo.project.name.includes('-dev')
}

/**
 * Checks if the current test run is executing in testing mode.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object.
 * @returns {boolean}
 */
export function isTestingMode (testInfo) {
  return testInfo.project.name.includes('testing')
}

/**
 * Skips the current test in production mode.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object.
 * @param {string} [reason] - Reason for skipping.
 */
export function skipInProduction (testInfo, reason = 'Test is development/testing mode specific') {
  if (isProduction(testInfo)) {
    test.skip(true, reason)
  }
}

/**
 * Skips the current test in development mode.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object.
 * @param {string} [reason] - Reason for skipping.
 */
export function skipInDevelopment (testInfo, reason = 'Test is production mode specific') {
  if (isDevelopment(testInfo)) {
    test.skip(true, reason)
  }
}

/**
 * Returns the output build directory corresponding to the test mode.
 * @param {import('@playwright/test').TestInfo} testInfo - Playwright test info object.
 * @returns {string}
 */
export function getOutputDir (testInfo) {
  return isProduction(testInfo) ? '.coralite-prod' : '.coralite-dev'
}
