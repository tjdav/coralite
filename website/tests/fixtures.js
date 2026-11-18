import { test as base, expect } from '@playwright/test'

/**
 * Extends the default page fixture so every navigation waits for webfonts.
 * Self-hosted fonts load asynchronously, and a screenshot taken before they
 * settle uses fallback metrics and produces false visual diffs.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page)

    page.goto = async (...args) => {
      const response = await originalGoto(...args)
      await page.evaluate(async () => {
        await document.fonts.ready
      })

      // Wait until the font stylesheet is actually in effect (cold dev servers
      // can serve the page before the rebuilt stylesheet resolves).
      await page.waitForFunction(async () => {
        const faces = await document.fonts.load('400 16px Inter')
        return faces.length > 0 && faces.every(face => face.status === 'loaded')
      }, undefined, { timeout: 10000 }).catch(() => {})

      await page.evaluate(async () => {
        const faces = [
          '400 16px Inter',
          '500 16px Inter',
          '600 16px Inter',
          '700 16px Inter',
          '400 14px "JetBrains Mono"',
          '500 14px "JetBrains Mono"',
          '700 14px "JetBrains Mono"'
        ]
        await Promise.all(faces.map(face => document.fonts.load(face))).catch(() => {})
        await document.fonts.ready
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      return response
    }

    await use(page)
  }
})

export { expect }
