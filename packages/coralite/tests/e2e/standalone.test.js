import { test, expect } from '@playwright/test'

test.describe('Standalone Web Components', () => {
  test('should render standalone component and execute its script logic correctly', async ({ page }) => {
    await page.goto('/standalone.html')

    // Wait for the custom element to be defined
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const btnElement = page.locator('#my-dynamic-btn')
    await expect(btnElement).toBeVisible()

    // Check hydration of standard attributes
    await expect(btnElement).toHaveAttribute('class', 'custom-class')

    // Query inside the shadow DOM for button
    const buttonInsideShadow = btnElement.locator('button')
    await expect(buttonInsideShadow).toBeVisible()
    await expect(buttonInsideShadow).toHaveText('Dynamic Button')

    // Query inside the shadow DOM for the output div to verify async setup resolution
    const outputInsideShadow = btnElement.locator('.output')
    await expect(outputInsideShadow).toBeVisible()
    await expect(outputInsideShadow).toHaveText('Loaded from setup!')

    // Click the button. Playwright automatically penetrates open shadow roots.
    await buttonInsideShadow.click()

    // The component's script dispatches an event which the light DOM script catches to update the paragraph
    const resultText = page.locator('#result-text')
    await expect(resultText).toHaveText('Button was clicked from component event!')

    // Verify that the confetti script loaded and updated the text inside shadow DOM
    await expect(outputInsideShadow).toHaveText('Confetti fired!')
  })
})
