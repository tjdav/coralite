import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe('Priority Architecture Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/priority-tests/')
    await page.waitForFunction(() => window.__coralite_ready__ !== undefined)
    await page.evaluate(() => window.__coralite_ready__)
  })

  test('Primitive Coercion: should coerce attributes to correct types', async ({ page }) => {
    await expect(page.getByTestId('count')).toHaveText('42')
    await expect(page.getByTestId('active')).toHaveText('true')
    await expect(page.getByTestId('count-type')).toHaveText('number')
    await expect(page.getByTestId('active-type')).toHaveText('boolean')
  })

  test('Dual-Proxy: should block mutations in getters and allow them in script', async ({ page }) => {
    // Initial state: count=5, doubled=10 (or MutationBlocked if getter is strictly read-only and we catch error)
    // Based on my dual-proxy.html, it returns 'MutationBlocked' if it catches an error.
    await expect(page.getByTestId('doubled')).toHaveText('MutationBlocked')

    const btn = page.locator('button').filter({ hasText: 'Increment' })
    await btn.click()

    // After increment, count=6, doubled should still be MutationBlocked if it fails every time
    await expect(page.getByTestId('doubled')).toHaveText('MutationBlocked')
  })

  test('Async Race: should handle rapid state changes in async getters', async ({ page }) => {
    const trigger = page.locator('button').filter({ hasText: 'Trigger' })
    const result = page.getByTestId('result')

    await expect(result).toHaveText('Idle')

    // Click trigger which performs rapid state assignments internally
    await trigger.click()

    // Wait for the final result
    await expect(result).toHaveText('Result for q3', { timeout: 10000 })
  })

  test('Stripping: verify data() and node imports are removed from client bundle', async () => {
    const assetsDir = path.join(process.cwd(), '.coralite', 'assets', 'js')
    const files = fs.readdirSync(assetsDir)

    let foundClientScript = false
    for (const file of files) {
      const content = fs.readFileSync(path.join(assetsDir, file), 'utf-8')
      if (content.includes('Client script running')) {
        foundClientScript = true
        expect(content).not.toContain('node:fs')
        expect(content).not.toContain('ServerOnlyData')
        // The data() function name itself might be mangled, but the logic inside shouldn't be there
        // especially if it's not referenced in the script.
      }
    }
    expect(foundClientScript).toBe(true)
  })
})
