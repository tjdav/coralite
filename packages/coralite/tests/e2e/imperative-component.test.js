import { test, expect } from '@playwright/test'

test.describe('E2E Hydration Parent component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e-hydration.html')
  })

  test('dynamically created child component hydrates securely with the parent script system', async ({ page }) => {
    // Parent components are completely unwrapped during SSR, but they render their content.
    // The `<hydrated-button>` is dynamically appended inside the parent's container.
    const parentContainer = page.locator('#parent-container')
    const btnComponent = parentContainer.locator('hydrated-button')

    // Verify parent's DOM payload renders and child injected
    await expect(parentContainer).toBeVisible()
    await expect(btnComponent).toBeVisible()

    // It should render the initial HTML via shadow root correctly
    const btnEl = btnComponent.locator('button')
    await expect(btnEl).toHaveText('Click Me Dynamic')

    // It should have hydrated the default value from setup
    const countEl = btnComponent.locator('div').first() // The fixtureCount div is the first div
    await expect(countEl).toHaveText('0')

    // It should have scoped styles
    await expect(btnEl).toHaveCSS('background-color', 'rgb(0, 0, 255)')

    // It should be interactive (executes its own script context)
    await btnEl.click()
    await expect(countEl).toHaveText('1')
    await btnEl.click()
    await expect(countEl).toHaveText('2')

    // It should share the exact same global helpers object instances (verified by checking a random number plugin)
    // The second div in parentContainer is the parent's `parentHelperOut` output (since the first is `container`)
    const parentHelperOut = parentContainer.locator('div').nth(1)

    // The child helper output is inside the shadowRoot of the dynamically created web component (it's the 2nd div inside it)
    const childHelperOut = btnComponent.locator('div').nth(1)

    const parentVal = await parentHelperOut.textContent()
    const childVal = await childHelperOut.textContent()

    expect(parentVal).toBeTruthy()
    expect(parentVal).toBe(childVal)
  })
})
