import { test, expect } from '@playwright/test'

test.describe('Client Runtime: Reactive Tokens & Web Components', () => {

  test('should replace static tokens and evaluate computed functions on initialization', async ({ page }) => {
    // Navigate to a page that mounts reactive-token
    await page.goto('/reactive-token-page.html')

    // Wait for the reactive-token-child DOM to initialize inside parent
    await page.waitForFunction(() => {
      // parent is just a regular div with ref="target"
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      if (!target) {
        return false
      }

      const children = target.querySelectorAll('reactive-token-child')
      if (children.length < 2) {
        return false
      }

      return children[0].querySelector('h3') &&
             children[1].querySelector('h3')
    }, { timeout: 10000 })

    // Extract the evaluated tokens from the first reactive-token-child template
    const child1Tokens = await page.evaluate(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      const child = target.querySelectorAll('reactive-token-child')[0]

      return {
        title: child.querySelector('h3').textContent,
        valueText: child.querySelector('p').textContent
      }
    })

    // Extract the evaluated tokens from the second reactive-token-child template
    const child2Tokens = await page.evaluate(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      const child = target.querySelectorAll('reactive-token-child')[1]

      return {
        title: child.querySelector('h3').textContent,
        valueText: child.querySelector('p').textContent
      }
    })

    // Verify first child initialized correctly
    expect(child1Tokens.title).toBe('Initial Title')
    expect(child1Tokens.valueText).toBe('Value: 0')

    // Verify second child updated correctly based on the sequence
    expect(child2Tokens.title).toBe('Updated Title')
    expect(child2Tokens.valueText).toBe('Value: 100')
  })

  test('should fallback to defaults when attributes are missing', async ({ page }) => {
    // Navigate to a page that mounts reactive-token
    await page.goto('/reactive-token-page.html')

    await page.evaluate(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      const comp = document.createElement('reactive-token-child')
      comp.id = 'dynamic-comp'
      target.appendChild(comp)
    })

    // Wait for the reactive-token DOM to initialize
    await page.waitForFunction(() => {
      const comp = document.querySelector('#dynamic-comp')
      return comp && comp.querySelector('h3')
    }, { timeout: 10000 })

    // Extract the evaluated tokens from the reactive-token template
    const { title, valueText } = await page.evaluate(() => {
      const element = document.querySelector('#dynamic-comp')
      return {
        title: element.querySelector('h3').textContent,
        valueText: element.querySelector('p').textContent
      }
    })

    expect(title).toBe('')
    expect(valueText).toBe('Value: 0')
  })

  test('should reactively update template when attributes change', async ({ page }) => {
    await page.goto('/reactive-token-page.html')

    // Wait for the reactive-token-child DOM to initialize inside parent
    await page.waitForFunction(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      if (!target) {
        return false
      }

      const children = target.querySelectorAll('reactive-token-child')
      if (children.length < 1) {
        return false
      }

      return children[0].querySelector('h3')
    }, { timeout: 10000 })

    // Change the attribute via standard JS to trigger the MutationObserver
    await page.evaluate(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      const child = target.querySelectorAll('reactive-token-child')[0]
      child.setAttribute('title', 'Mutated Title')
    })

    // Wait for the debounced render cycle to complete and update the DOM
    await page.waitForFunction(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      const child = target.querySelectorAll('reactive-token-child')[0]
      return child.querySelector('h3').textContent === 'Mutated Title'
    }, { timeout: 10000 })

    const valueText = await page.evaluate(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      const child = target.querySelectorAll('reactive-token-child')[0]
      return child.querySelector('p').textContent
    })

    // 'Mutated Title' !== 'Updated Title' so it evaluates to '0'
    expect(valueText).toBe('Value: 0')
  })

  test('should execute client scripts on initialization', async ({ page }) => {
    // Test script execution
    await page.goto('/reactive-token-page.html')

    // Wait for the reactive-token-child DOM to initialize inside parent
    await page.waitForFunction(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      if (!target) {
        return false
      }

      const children = target.querySelectorAll('reactive-token-child')
      if (children.length < 1) {
        return false
      }

      return children[0].querySelector('div')
    }, { timeout: 10000 })

    const valueText = await page.evaluate(() => {
      const target = document.querySelector('[ref^="reactive-token-parent__target"]')
      const child = target.querySelectorAll('reactive-token-child')[0]
      return child.querySelector('div').textContent
    })

    expect(valueText).toBe('Script executed')
  })

  test('should pass a valid signal to declarative components', async ({ page }) => {
    // Navigating to page triggers the reactive-token-parent (declarative component) script
    await page.goto('/reactive-token-page.html')

    await page.waitForFunction(() => window.declarativeSignalAvailable !== undefined)

    const hasDeclarativeSignal = await page.evaluate(() => window.declarativeSignalAvailable)
    expect(hasDeclarativeSignal).toBe(true)
  })

})
