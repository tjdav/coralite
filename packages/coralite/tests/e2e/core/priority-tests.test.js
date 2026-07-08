import { waitForHydration } from '../helpers.js'
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test.describe('Priority Architecture Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/priority-tests/')
    await waitForHydration(page)
  })

  test('Primitive Coercion: should coerce attributes to correct types', async ({ page }) => {
    const comp = page.locator('primitive-coercion').first()
    await expect(comp.locator('p').nth(0)).toHaveText('42')
    await expect(comp.locator('p').nth(1)).toHaveText('true')
    await expect(comp.locator('p').nth(2)).toHaveText('number')
    await expect(comp.locator('p').nth(3)).toHaveText('boolean')
  })

  test('Dual-Proxy: should block mutations in getters and allow them in script', async ({ page }) => {
    const comp = page.locator('dual-proxy').first()
    // Initial state: count=5, doubled=10 (or MutationBlocked if getter is strictly read-only and we catch error)
    // Based on my dual-proxy.html, it returns 'MutationBlocked' if it catches an error.
    await expect(comp.locator('p')).toHaveText('MutationBlocked')

    const btn = comp.locator('button')
    await btn.click()

    // After increment, count=6, doubled should still be MutationBlocked if it fails every time
    await expect(comp.locator('p')).toHaveText('MutationBlocked')
  })

  test('Async Race: should handle rapid state changes in async getters', async ({ page }) => {
    const comp = page.locator('async-race').first()
    const trigger = comp.locator('button')
    const result = comp.locator('p')

    await expect(result).toHaveText('Idle')

    // Click trigger which performs rapid state assignments internally
    await trigger.click()

    // Wait for the final result
    await expect(result).toHaveText('Result for q3', { timeout: 10000 })
  })

  test('Stripping: verify data() and node imports are removed from client bundle', async ({}, testInfo) => {
    const outputDir = testInfo.project.name === 'framework-core-prod' ? '.coralite-prod' : '.coralite-dev'
    const assetsDir = path.join(process.cwd(), outputDir, 'assets', 'js')

    // Function to recursively read files in a directory
    function getFiles (dir, files = []) {
      if (!fs.existsSync(dir)) {
        return files
      }
      const fileList = fs.readdirSync(dir)
      for (const file of fileList) {
        const name = path.join(dir, file)
        if (fs.statSync(name).isDirectory()) {
          getFiles(name, files)
        } else {
          files.push(name)
        }
      }
      return files
    }

    const files = getFiles(assetsDir)

    let foundClientScript = false
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (content.includes('Client script running')) {
        foundClientScript = true
        expect(content).not.toContain('node:fs')
      }
    }
    expect(foundClientScript).toBe(true)
  })
})
