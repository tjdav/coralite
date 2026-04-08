import { test, expect } from '@playwright/test'

test.describe('Dynamic Component Loading', () => {

  test('should dynamically load and render a component that is inserted into the DOM asynchronously, and resolve declarative nested children', async ({ page }) => {
    await page.goto('/dynamic-loading-test.html')

    // Wait for the dynamically inserted child to be defined and render its Shadow DOM
    await page.waitForFunction(() => {
      const child = document.querySelector('dynamic-child')
      if (!child || !child.shadowRoot) return false
      const thisComp = child.shadowRoot.querySelector('this-component')
      return thisComp && thisComp.shadowRoot && thisComp.shadowRoot.querySelector('#this-component-loaded')
    }, { timeout: 5000 })

    const text = await page.evaluate(() => {
      const child = document.querySelector('dynamic-child')
      const thisComp = child.shadowRoot.querySelector('this-component')
      return thisComp.shadowRoot.querySelector('#this-component-loaded').textContent
    })

    expect(text).toBe('This Component Loaded!')

    // Check that declarative children are also loaded and processed
    const grandchildData = await page.evaluate(() => {
      const child = document.querySelector('dynamic-child')
      const grandchildren = child.shadowRoot.querySelectorAll('dynamic-grandchild')

      // Wait for grandchildren to initialize their shadow DOMs before checking
      if (grandchildren.length < 2 || !grandchildren[0].shadowRoot || !grandchildren[1].shadowRoot) {
        return null
      }

      return [
        grandchildren[0].shadowRoot.querySelector('.grandchild').textContent.trim(),
        grandchildren[1].shadowRoot.querySelector('.grandchild').textContent.trim()
      ]
    })

    expect(grandchildData).toEqual([
      'Dynamic Grandchild 1',
      'Dynamic Grandchild 2'
    ])

  })
})
