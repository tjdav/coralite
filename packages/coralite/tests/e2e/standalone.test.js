import { test, expect } from '@playwright/test'

test.describe('Standalone Web Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/standalone.html')
    // Wait for the custom elements to be defined by the standalone script
    await page.waitForFunction(() => customElements.get('standalone-wrapper') !== undefined)
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)
  })

  test('should dynamically inject components and execute setup/script logic correctly', async ({ page }) => {
    const wrapper = page.locator('standalone-wrapper')
    const dynamicComponent = wrapper.locator('my-button', { hasText: 'Dynamic Button' }).first()
    const btnElement = dynamicComponent.locator('.my-btn')

    // Verify dynamic injection worked
    await expect(btnElement).toBeVisible()
    await expect(btnElement).toContainText('Dynamic Button')

    // Verify async setup resolution (waits for the 50ms timeout)
    const outputDiv = dynamicComponent.locator('.output')
    await expect(outputDiv).toHaveText('Loaded from setup!')

    // Verify JSON import data was loaded correctly into the script context
    const jsonOutput = dynamicComponent.locator('.json-output')
    // Note: Assuming 'dummy-data.json' name property resolves to 'Coralite E2E' based on prior test
    await expect(jsonOutput).not.toBeEmpty()

    // Test interactivity and custom event bubbling
    const resultText = page.locator('#result-text')

    // Initial state check
    await expect(resultText).toBeEmpty()

    // Click the component button
    await btnElement.click()

    // Verify local component state changed via script (confetti logic)
    await expect(outputDiv).toHaveText('Confetti fired!')

    // Verify the CustomEvent with composed:true, bubbles:true reached the window listener
    await expect(resultText).toHaveText('Button was clicked from component event!')
  })

  test('should handle multiple instances independently', async ({ page }) => {
    const wrapper = page.locator('standalone-wrapper')
    const staticButton = wrapper.locator('my-button', { hasText: 'Click Me!' }).first()
    const dynamicButton = wrapper.locator('my-button', { hasText: 'Dynamic Button' })

    // Verify text props bound correctly
    await expect(staticButton.locator('.my-btn')).toContainText('Click Me!')
    await expect(dynamicButton.locator('.my-btn')).toContainText('Dynamic Button')

    // Click the static button and check if ONLY its state changed
    await staticButton.locator('.my-btn').click()
    await expect(staticButton.locator('.output')).toHaveText('Confetti fired!')

    // Dynamic button should remain in setup state
    await expect(dynamicButton.locator('.output')).toHaveText('Loaded from setup!')
  })

  test('should project content into slots correctly', async ({ page }) => {
    const wrapper = page.locator('standalone-wrapper')
    const slottedComponent = wrapper.locator('my-button', { hasText: 'Slotted' })

    // Verify the custom icon was projected into the <slot>
    const customIcon = slottedComponent.locator('.custom-icon')
    await expect(customIcon).toBeVisible()
    await expect(customIcon).toHaveText('🚀')
  })

  test('should encapsulate styles within the shadow DOM', async ({ page }) => {
    const wrapper = page.locator('standalone-wrapper')

    // The button inside the component should have the scoped blue color
    const componentBtn = wrapper.locator('my-button', { hasText: 'Click Me!' }).first().locator('.my-btn')
    await expect(componentBtn).toHaveCSS('background-color', 'rgb(0, 123, 255)')

    // The button outside the component (Leak Test) should NOT inherit the blue background
    const leakTestButton = wrapper.locator('button.my-btn', { hasText: 'Leak Test' })
    await expect(leakTestButton).not.toHaveCSS('background-color', 'rgb(0, 123, 255)')
  })
})
