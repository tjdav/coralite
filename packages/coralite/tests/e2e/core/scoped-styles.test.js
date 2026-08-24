import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('Scoped Styles E2E Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/scoped-styles/')
    await waitForHydration(page)
  })

  test('Test 1: Host styling & modifier states', async ({ page }) => {
    const hostDefault = page.locator('#host-default')
    await expect(hostDefault).toHaveCSS('display', 'block')
    await expect(hostDefault).toHaveCSS('background-color', 'rgb(250, 250, 250)')

    const hostActive = page.locator('#host-active')
    await expect(hostActive).toHaveCSS('border-color', 'rgb(0, 100, 255)')
    await expect(hostActive).toHaveCSS('background-color', 'rgb(240, 248, 255)')

    const hostDisabled = page.locator('#host-disabled')
    await expect(hostDisabled).toHaveCSS('opacity', '0.5')
    await expect(hostDisabled).toHaveCSS('pointer-events', 'none')
  })

  test('Test 2: Context styling (:host-context)', async ({ page }) => {
    const contextDefault = page.locator('#context-default')
    await expect(contextDefault).toHaveCSS('color', 'rgb(0, 0, 0)')
    await expect(contextDefault).toHaveCSS('background-color', 'rgb(255, 255, 255)')

    const contextDark = page.locator('#context-dark')
    await expect(contextDark).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(contextDark).toHaveCSS('background-color', 'rgb(20, 20, 20)')

    const contextRtl = page.locator('#context-rtl')
    await expect(contextRtl).toHaveCSS('text-align', 'right')

    const contextDarkActive = page.locator('#context-dark-active')
    await expect(contextDarkActive).toHaveCSS('border-color', 'rgb(255, 215, 0)')
  })

  test('Test 3: Nested Component Isolation', async ({ page }) => {
    const parentTitle = page.locator('#nested-parent > .parent-box > .item-title')
    await expect(parentTitle).toHaveCSS('color', 'rgb(255, 0, 0)')

    const childTitle = page.locator('#nested-parent scoped-nested-child .item-title')
    await expect(childTitle).toHaveCSS('color', 'rgb(0, 0, 255)')
    await expect(childTitle).not.toHaveCSS('color', 'rgb(255, 0, 0)')
  })

  test('Test 4: Global Style Zero-Leakage', async ({ page }) => {
    const globalTitle = page.locator('.global-card-title')
    await expect(globalTitle).not.toHaveCSS('color', 'rgb(30, 30, 30)')
  })

  test('Test 5: Reactive Style Object (style: {})', async ({ page }) => {
    const reactiveComp = page.locator('#reactive-comp')
    await expect(reactiveComp).toHaveCSS('background-color', 'rgb(240, 240, 240)')
    await expect(reactiveComp).toHaveCSS('color', 'rgb(50, 50, 50)')

    const toggleBtn = reactiveComp.locator('.toggle-btn')
    await toggleBtn.click()

    await expect(reactiveComp).toHaveCSS('background-color', 'rgb(255, 230, 150)')
    await expect(reactiveComp).toHaveCSS('color', 'rgb(180, 50, 0)')
  })

  test('Test 6: Imperative Mount & Subtree Isolation', async ({ page }) => {
    const mountBtn = page.locator('#mount-imperative-btn')
    await mountBtn.click()

    const imperativeCard = page.locator('#imperative-mount #imperative-card.active')
    await expect(imperativeCard).toBeVisible()
    await expect(imperativeCard).toHaveCSS('border-color', 'rgb(0, 100, 255)')
    await expect(imperativeCard).toHaveCSS('background-color', 'rgb(240, 248, 255)')

    const cardTitle = imperativeCard.locator('.card-title')
    await expect(cardTitle).toHaveCSS('color', 'rgb(30, 30, 30)')

    const globalTitle = page.locator('.global-card-title')
    await expect(globalTitle).not.toHaveCSS('color', 'rgb(30, 30, 30)')

    const mountNestedBtn = page.locator('#mount-nested-imperative-btn')
    await mountNestedBtn.click()

    const imperativeNestedChild = page.locator('#nested-parent #imperative-nested-child')
    await expect(imperativeNestedChild).toBeVisible()

    const childTitle = imperativeNestedChild.locator('.item-title')
    await expect(childTitle).toHaveCSS('color', 'rgb(0, 0, 255)')
    await expect(childTitle).not.toHaveCSS('color', 'rgb(255, 0, 0)')
  })
})
