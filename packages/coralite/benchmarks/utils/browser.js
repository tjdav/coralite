import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'

/**
 * Launches Playwright browser instance for internal benchmarks.
 * @param {object} [options={}] Launch options
 * @returns {Promise<import('@playwright/test').Browser>} Browser instance
 */
export async function launchBenchmarkBrowser (options = {}) {
  const defaultChromePath = existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined
  return await chromium.launch({
    headless: true,
    executablePath: options.executablePath || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || defaultChromePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    ...options
  })
}
