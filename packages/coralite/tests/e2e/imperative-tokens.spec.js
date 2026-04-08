import { test, expect } from '@playwright/test'

test('imperative component tokens are passed correctly and remain reactive', async ({ page }) => {
  await page.goto('/imperative-tokens-test.html')

  const child = page.locator('imperative-tokens-child')
  await child.waitFor({ state: 'attached' })

  const output = child.locator('#test-output')
  await expect(output).toHaveText('hello world')

  const stepOutput = child.locator('#test-output-step')
  await expect(stepOutput).toHaveText('6') // initial start was 5

  // Verify reactivity when attribute changes
  await child.evaluate(node => node.setAttribute('start', '10'))
  await expect(stepOutput).toHaveText('11')
})
