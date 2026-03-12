import { test, expect } from '@playwright/test'

test.describe('Standalone Web Components', () => {
  test('should render standalone component and execute its script logic correctly', async ({ page }) => {
    await page.goto('/standalone.html')

    // Wait for the custom elements to be defined
    await page.waitForFunction(() => customElements.get('standalone-wrapper') !== undefined)
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const wrapper = page.locator('standalone-wrapper')
    const componentLocator = wrapper.locator('my-button', { hasText: 'Dynamic Button' }).first()
    const btnElement = componentLocator.locator('.my-btn')

    await expect(btnElement).toBeVisible()
    await expect(btnElement).toHaveText('Dynamic Button')

    // Query inside the shadow DOM for the output div to verify async setup resolution
    const outputInsideShadow = componentLocator.locator('.output')
    await expect(outputInsideShadow).toHaveText('Loaded from setup!')

    // Query inside the shadow DOM to verify json import works
    const jsonOutputInsideShadow = componentLocator.locator('.json-output')
    await expect(jsonOutputInsideShadow).toHaveText('Coralite E2E')

    // Wait for event to process if necessary, wait for promise to resolve, click the button
    const resultText = page.locator('#result-text')

    // We expect the button to dispatch the event which sets text
    await btnElement.click()

    // The component's script dispatches an event which the light DOM script catches to update the paragraph
    await expect(resultText).toHaveText('Button was clicked from component event!', { timeout: 10000 })

    // Verify that the confetti script loaded and updated the text inside shadow DOM
    await expect(outputInsideShadow).toHaveText('Confetti fired!')
  })

  test('should handle multiple instances independently', async ({ page }) => {
    await page.goto('/standalone.html')
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const wrapper = page.locator('standalone-wrapper')
    const staticButton = wrapper.locator('my-button', { hasText: 'Click Me!' }).last()
    const dynamicButton = wrapper.locator('my-button', { hasText: 'Dynamic Button' })

    // Verify both rendered their text props
    await expect(staticButton.locator('.my-btn')).toHaveText('Click Me!')
    await expect(dynamicButton.locator('.my-btn')).toHaveText('Dynamic Button')

    // Click the static button and check if ONLY its state changed
    await staticButton.locator('.my-btn').click()
    await expect(staticButton.locator('.output')).toHaveText('Confetti fired!')
    await expect(dynamicButton.locator('.output')).toHaveText('Loaded from setup!') // Should remain unchanged
  })

  test('should respect data-skip-render attribute', async ({ request, page }) => {
    // 1. Check raw HTML to ensure it wasn't rendered on the server
    const response = await request.get('/standalone.html')
    const html = await response.text()

    // The raw HTML should just be the tag, without the internal .my-btn template expanded
    expect(html).toContain('<my-button text="Skip SSR" data-skip-render="true"></my-button>')

    // 2. Load the page and verify the client-side script expands it
    await page.goto('/standalone.html')
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    // In standalone wrapper it should also render on client side.
    const wrapper = page.locator('standalone-wrapper')
    const skippedComponent = wrapper.locator('my-button[data-skip-render="true"]')
    const btnElement = skippedComponent.locator('.my-btn')
    await expect(btnElement).toBeVisible()

    // Test the page-level skip render too
    const pageSkippedComponent = page.locator('body > my-button[data-skip-render="true"]')
    const pageBtnElement = pageSkippedComponent.locator('.my-btn')
    await expect(pageBtnElement).toBeVisible()
    await expect(pageBtnElement).toHaveText('Skip SSR')
  })

  test('should update DOM when observed attributes change', async ({ page }) => {
    await page.goto('/standalone.html')
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const wrapper = page.locator('standalone-wrapper')
    const component = wrapper.locator('my-button', { hasText: 'Dynamic Button' })

    // Check initial state
    await expect(component.locator('.my-btn')).toHaveText('Dynamic Button')

    // Change the attribute via JS
    await component.evaluate((node) => node.setAttribute('text', 'Updated Text!'))

    // Verify the component re-rendered the new text
    await expect(component.locator('.my-btn')).toHaveText('Updated Text!')
  })

  test('should project content into slots correctly', async ({ page }) => {
    await page.goto('/standalone.html')
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const wrapper = page.locator('standalone-wrapper')
    const component = wrapper.locator('my-button', { hasText: 'Slotted' })

    // For slots, Playwright interacts with the light DOM child directly if we want to verify visibility.
    // The `<span class="custom-icon">` is in the light DOM of the my-button component.
    const customIcon = component.locator('.custom-icon')

    await expect(customIcon).toBeVisible()
    await expect(customIcon).toHaveText('🚀')
  })

  test('should encapsulate styles within the shadow DOM', async ({ page }) => {
    await page.goto('/standalone.html')
    await page.waitForFunction(() => customElements.get('my-button') !== undefined)

    const wrapper = page.locator('standalone-wrapper')
    const btnElement = wrapper.locator('my-button', { hasText: 'Dynamic Button' }).locator('.my-btn')

    // Verify the button has the expected scoped background-color from my-button.html style
    await expect(btnElement).toHaveCSS('background-color', 'rgb(0, 123, 255)')

    // Verify that an element outside the component with the same class DOES NOT get the style
    const leakTestButton = wrapper.locator('button.my-btn', { hasText: 'Leak Test' })
    await expect(leakTestButton).not.toHaveCSS('background-color', 'rgb(0, 123, 255)')
  })
})
