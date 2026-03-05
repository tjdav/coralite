import { test, expect } from '@playwright/test'

test.describe('Standalone Web Components', () => {
  test('should render standalone component and execute its script logic correctly', async ({ page }) => {
    await page.goto('/standalone.html')

    // Wait for the custom element to be defined
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const componentLocator = page.locator('my-button', { hasText: 'Dynamic Button' }).first()
    const btnElement = componentLocator.locator('.my-btn')

    await expect(btnElement).toBeVisible()
    await expect(btnElement).toHaveText('Dynamic Button')

    // Query inside the shadow DOM for the output div to verify async setup resolution
    const outputInsideShadow = componentLocator.locator('.output')
    await expect(outputInsideShadow).toHaveText('Loaded from setup!')

    // Wait for event to process if necessary, wait for promise to resolve, click the button
    const resultText = page.locator('#result-text')

    // We expect the button to dispatch the event which sets text
    await btnElement.click()

    // The component's script dispatches an event which the light DOM script catches to update the paragraph
    await expect(resultText).toHaveText('Button was clicked from component event!', { timeout: 10000 })

    // Verify that the confetti script loaded and updated the text inside shadow DOM
    await expect(outputInsideShadow).toHaveText('Confetti fired!')
  })
})
