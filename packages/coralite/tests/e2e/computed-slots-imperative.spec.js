import { test, expect } from '@playwright/test'

test.describe('Computed Slots Imperative', () => {
  test('should update computed slots dynamically on attribute change and handle node array modifications', async ({ page }) => {
    // Navigate and log errors
    page.on('console', msg => console.log(msg.text()))
    page.on('pageerror', err => console.log(err.message))

    await page.goto('/computed-slots-imperative.html')

    await page.waitForFunction(() => typeof window.mountComponent === 'function')
    await page.evaluate(() => window.mountComponent())

    // Wait for the custom element to be defined and mounted
    await page.waitForSelector('computed-slots-imperative h1.header-slot')

    let headerContent = await page.locator('computed-slots-imperative h1.header-slot').textContent()

    // Test the node modification (should have wrapped the nodes with a div containing the body text)
    let projectedNodes = page.locator('computed-slots-imperative .body-slot-node')
    await expect(projectedNodes).toHaveCount(2)
    let node1Text = await projectedNodes.nth(0).textContent()
    let node2Text = await projectedNodes.nth(1).textContent()

    expect(headerContent).toBe('Title: Initial Title')
    expect(node1Text).toContain('Body: Initial Body')
    expect(node1Text).toContain('Projected Node 1')
    expect(node2Text).toContain('Body: Initial Body')
    expect(node2Text).toContain('Projected Node 2')

    // Dynamically change attributes
    await page.evaluate(() => {
      const el = document.querySelector('computed-slots-imperative')
      el.setAttribute('title', 'Updated Title')
      el.setAttribute('body', 'Updated Body')
    })

    // Wait for updates to take effect via MutationObserver and re-render
    await page.waitForFunction(() => {
      const h1 = document.querySelector('computed-slots-imperative h1.header-slot')
      return h1 && h1.textContent === 'Title: Updated Title'
    })

    headerContent = await page.locator('computed-slots-imperative h1.header-slot').textContent()
    projectedNodes = page.locator('computed-slots-imperative .body-slot-node')
    node1Text = await projectedNodes.nth(0).textContent()
    node2Text = await projectedNodes.nth(1).textContent()

    expect(headerContent).toBe('Title: Updated Title')
    expect(node1Text).toContain('Body: Updated Body')
    expect(node1Text).toContain('Projected Node 1')
    expect(node2Text).toContain('Body: Updated Body')
    expect(node2Text).toContain('Projected Node 2')
  })
})
