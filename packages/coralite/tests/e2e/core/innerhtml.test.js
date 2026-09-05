import { waitForHydration, isProduction } from '../helpers.js'
import { test, expect } from '@playwright/test'

test.describe('InnerHTML Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/innerhtml-test/')
    await waitForHydration(page)
  })

  test('should create components via innerHTML, outerHTML and insertAdjacentHTML', async ({ page }, testInfo) => {
    const children = page.locator('innerhtml-child')
    await expect(children).toHaveCount(3)

    const child1 = children.nth(0)
    await expect(child1).toHaveAttribute('data-cid')
    await expect(child1.locator('h2')).toHaveText('InnerHTML Mount')

    const child2 = children.nth(1)
    await expect(child2).toHaveAttribute('data-cid')
    await expect(child2.locator('h2')).toHaveText('OuterHTML Mount')

    const child3 = children.nth(2)
    await expect(child3).toHaveAttribute('data-cid')
    await expect(child3.locator('h2')).toHaveText('AdjacentHTML Mount')

    if (isProduction(testInfo)) {
      // In production, data-testid should be stripped completely
      await expect(page.locator('[data-testid="plain-inner"]')).toHaveCount(0)
      await expect(page.locator('[data-testid$="plain-inner"]')).toHaveCount(0)
    } else {
      // In non-production, the innerHTML's data-testid must be prefixed with the parent instance ID
      const plainInner = page.getByTestId(/innerhtml-parent-\d+__plain-inner/)
      await expect(plainInner).toBeVisible()
      await expect(plainInner).toHaveText('Plain Inner')
    }
  })

  test('should support uncompiled innerHTML mounting outside component client() definition', async ({ page }, testInfo) => {
    await page.evaluate(() => {
      const mount = document.createElement('div')
      mount.id = 'uncompiled-mount'
      mount.innerHTML = '<innerhtml-child message="Uncompiled Mount"></innerhtml-child>'
      document.body.appendChild(mount)
    })

    const mount = page.locator('#uncompiled-mount')
    await expect(mount).toBeVisible()

    if (isProduction(testInfo)) {
      // In production, prototype patching is omitted, so uncompiled innerHTML insertion does not patch setters
      const child = mount.locator('innerhtml-child')
      await expect(child).toHaveCount(1)
    } else {
      // In development & testing mode, uncompiled innerHTML triggers component fetch and auto-upgrade
      const child = mount.locator('innerhtml-child')
      await expect(child).toBeVisible()
      await expect(child.locator('h2')).toHaveText('Uncompiled Mount')
    }
  })

  test('should support detached element innerHTML mounting and auto-upgrade', async ({ page }, testInfo) => {
    await page.evaluate(() => {
      const detached = document.createElement('div')
      detached.id = 'detached-mount'
      detached.innerHTML = '<innerhtml-child message="Detached Mount"></innerhtml-child>'
      document.body.appendChild(detached)
    })

    const detachedMount = page.locator('#detached-mount')
    await expect(detachedMount).toBeVisible()

    if (isProduction(testInfo)) {
      const child = detachedMount.locator('innerhtml-child')
      await expect(child).toHaveCount(1)
    } else {
      const child = detachedMount.locator('innerhtml-child')
      await expect(child).toBeVisible()
      await expect(child.locator('h2')).toHaveText('Detached Mount')
    }
  })

  test('should upgrade nested compound components when injected dynamically', async ({ page }, testInfo) => {
    await page.evaluate(() => {
      const wrapper = document.createElement('div')
      wrapper.id = 'compound-wrapper'
      wrapper.innerHTML = '<innerhtml-parent id="dynamic-parent"></innerhtml-parent>'
      document.body.appendChild(wrapper)
    })

    const wrapper = page.locator('#compound-wrapper')
    await expect(wrapper).toBeVisible()

    if (isProduction(testInfo)) {
      const dynamicParent = wrapper.locator('innerhtml-parent')
      await expect(dynamicParent).toHaveCount(1)
    } else {
      const dynamicParent = wrapper.locator('innerhtml-parent')
      await expect(dynamicParent).toBeVisible()
      const children = dynamicParent.locator('innerhtml-child')
      await expect(children).toHaveCount(3)
    }
  })

  test('should verify production mode leaves native DOM setters untouched', async ({ page }, testInfo) => {
    if (isProduction(testInfo)) {
      const isNativeCreateElement = await page.evaluate(() => {
        return document.createElement.toString().includes('[native code]')
      })
      expect(isNativeCreateElement).toBe(true)
    }
  })
})
