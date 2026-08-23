import { waitForHydration, isProduction } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Slots Projection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slots-projection/')
    await waitForHydration(page)
  })

  test('should render fallback content when slot is empty', async ({ page }) => {
    const fallbackTest = page.locator('#fallback-test')
    await expect(fallbackTest).toContainText('Fallback Content')
  })

  test('should transform slot content if transformation returns string', async ({ page }) => {
    const transformTest = page.locator('#transform-test')
    await expect(transformTest).toContainText('Transformed: Transform Me')
  })

  test('should preserve original nodes and state when transformation returns void', async ({ page }) => {
    const preserveTest = page.locator('#preserve-test')
    const btn = preserveTest.locator('button')

    await expect(btn).toHaveText('Unchanged')
    await btn.click()
    await expect(btn).toHaveText('Clicked')
  })

  test('should successfully resolve nested refs within slot projections of custom components', async ({ page }, testInfo) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()))
    page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message))
    
    const isProd = isProduction(testInfo)

    const container = page.locator('#slot-nested-test')
    const input = isProd ? container.locator('input') : page.getByTestId(/slot-test-container-\d+__search-bar/)
    const button = isProd ? container.locator('button') : page.getByTestId(/slot-test-container-\d+__cancel-button/)
    const status = isProd ? container.locator('.test-container > div').last() : page.getByTestId(/slot-test-container-\d+__status-output/)

    // Confirm initial state is rendered and hydrated
    await expect(status).toHaveText('Idle')

    // Click cancel button to trigger event listener registered via refs('btnCancel')
    await button.click()
    await expect(status).toHaveText('Cancelled')

    // Fill search bar to trigger event listener registered via refs('searchBar')
    await input.fill('Atoll Search Query')
    await expect(status).toHaveText('Searching: Atoll Search Query')
  })

  test('should preserve reactivity and component boundaries on template token interpolations within nested slot projections', async ({ page }) => {
    const container = page.locator('#lost-reactivity-test')
    const textSpan = container.locator('.target-span')
    const button = container.locator('.change-btn')

    // 1. Initially should display 'Edit'
    await expect(textSpan).toHaveText('Edit')

    // 2. Click button to trigger parent state change
    await button.click()

    // 3. Reactively updates inside the slot to 'Save'
    await expect(textSpan).toHaveText('Save')

    // 4. Assert component boundary is fully intact (i.e. child container hasn't been destroyed or overwritten)
    const childContainer = container.locator('.child-container')
    await expect(childContainer).toBeVisible()
  })

  test('should dynamically reconcile light DOM elements appended after component connection', async ({ page }) => {
    await page.evaluate(async () => {
      const comp = document.querySelector('#dynamic-slot-comp')
      const dynamicEl = document.createElement('div')
      dynamicEl.className = 'dynamic-child'
      dynamicEl.textContent = 'Dynamic Appended Content'
      comp.appendChild(dynamicEl)
    })

    const dynamicChild = page.locator('#dynamic-slot-comp .dynamic-child')
    await expect(dynamicChild).toHaveText('Dynamic Appended Content')
  })

  test('should project direct forwarded slots (<slot slot="...">) declaratively and imperatively in browser runtime', async ({ page }) => {
    // 1. Declarative SSR slot forwarding
    const declContainer = page.locator('#forwarded-slot-declarative-test')
    const headerTitle = declContainer.locator('.fwd-card-header .fwd-title')
    const bodyContent = declContainer.locator('.fwd-card-body .fwd-body')

    await expect(headerTitle).toHaveText('Declarative Header Content')
    await expect(bodyContent).toHaveText('Declarative Body Content')

    // 2. Dynamic imperative slot forwarding
    await page.evaluate(() => {
      const target = document.querySelector('#forwarded-slot-imperative-test')
      const userCard = document.createElement('fwd-user-card')

      const h2 = document.createElement('h2')
      h2.setAttribute('slot', 'userHeader')
      h2.className = 'imp-title'
      h2.textContent = 'Imperative Header Content'

      const p = document.createElement('p')
      p.className = 'imp-body'
      p.textContent = 'Imperative Body Content'

      userCard.appendChild(h2)
      userCard.appendChild(p)
      target.appendChild(userCard)
    })

    const impContainer = page.locator('#forwarded-slot-imperative-test')
    const impHeaderTitle = impContainer.locator('.fwd-card-header .imp-title')
    const impBodyContent = impContainer.locator('.fwd-card-body .imp-body')

    await expect(impHeaderTitle).toHaveText('Imperative Header Content')
    await expect(impBodyContent).toHaveText('Imperative Body Content')
  })
})

test.describe('Nested Refs through Foreign Custom Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/nested-refs/')
    await waitForHydration(page)
  })

  test('resolves refs nested in light-DOM child custom elements and keeps them live', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    const container = page.locator('#nested-ref-test')
    const status = container.locator('.theme-status')
    const toggle = container.locator('.toggle-btn')
    const themeBtn = container.locator('.theme-btn')

    // Initial SSR / reactive render
    await expect(status).toHaveText('Light')

    // Independent control: top-level ref is live -> component hydrated
    await toggle.click()             // Light -> Dark
    await expect(status).toHaveText('Dark')

    // THE regression: deep ref must be live. Pre-fix refs('btnChangeTheme') was null,
    // so no listener was attached (or client() threw).
    await toggle.click()             // Dark -> Light
    await themeBtn.click()           // Light -> Dark, only if the deep listener exists
    await expect(status).toHaveText('Dark')

    // The resolved deep ref received the framework-unique ref attribute
    await expect(themeBtn).toHaveAttribute('ref', /nested-ref-parent-\d+__btnChangeTheme/)

    // No unhandled exceptions (e.g. reading addEventListener of null)
    expect(pageErrors).toEqual([])
  })
})
