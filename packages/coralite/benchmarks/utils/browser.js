import { chromium } from '@playwright/test'

/**
 *
 */
export async function launchBenchmarkBrowser (options = {}) {
  return await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    ...options
  })
}
