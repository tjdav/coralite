import { test, expect } from '@playwright/test'

test.describe('Lists Plugin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lists-app/')
    await page.waitForFunction(() => window.__virtualListReady__ === true)
  })

  test('virtualization renders a subset of items', async ({ page }) => {
    const container = page.locator('.container').first()
    const items = container.locator('.list-item')

    await expect(items.first()).toBeVisible()
    const count = await items.count()
    expect(count).toBeLessThan(50)
  })

  test('chat timeline anchors to end and follows new messages', async ({ page }) => {
    const chatContainer = page.locator('.chat-container')

    const scrollTop = await chatContainer.evaluate(el => el.scrollTop)
    const scrollHeight = await chatContainer.evaluate(el => el.scrollHeight)
    const clientHeight = await chatContainer.evaluate(el => el.clientHeight)

    expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 5)

    await page.click('#add-msg')

    await page.waitForTimeout(100)

    const newScrollTop = await chatContainer.evaluate(el => el.scrollTop)
    expect(newScrollTop).toBeGreaterThan(scrollTop)
  })
})
