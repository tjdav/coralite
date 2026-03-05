import { test, expect } from '@playwright/test'

test.describe('Standalone Web Components', () => {
  test('should render standalone component and execute its script logic correctly', async ({ page }) => {
    await page.goto('/standalone.html')

    // Wait for the custom element to be defined
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const btnElement = page.locator('#my-dynamic-btn')
    await expect(btnElement).toBeVisible()

    // Query inside the shadow DOM
    const buttonInsideShadow = btnElement.locator('button')
    await expect(buttonInsideShadow).toBeVisible()
    await expect(buttonInsideShadow).toHaveText('Dynamic Button')

    // Click the button. Playwright automatically penetrates open shadow roots.
    await buttonInsideShadow.click()

    // The component's script dispatches an event which the light DOM script catches to update the paragraph
    const resultText = page.locator('#result-text')
    await expect(resultText).toHaveText('Button was clicked from component event!')
  })
})
