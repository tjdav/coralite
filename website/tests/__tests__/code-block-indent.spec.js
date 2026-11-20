import { test, expect } from '../fixtures.js'

/**
 * Counts leading whitespace characters.
 * @param {string} line - Source line.
 * @returns {number} Number of leading spaces or tabs.
 */
function indentOf (line) {
  return line.match(/^[ \t]*/)[0].length
}

test('multi-line code blocks keep their authored indentation after hydration', async ({ page }) => {
  await page.goto('/reference/cli/')
  await page.waitForLoadState('networkidle')

  const commands = page.locator('code-block').filter({ hasText: 'coralite dev' }).first()
  const commandLines = (await commands.locator('pre').textContent()).split('\n').filter(line => line.trim())
  expect(commandLines.map(indentOf)).toEqual(commandLines.map(() => 0))

  const flags = page.locator('code-block').filter({ hasText: '--no-incremental' }).first()
  const flagLines = (await flags.locator('pre').textContent()).split('\n').filter(line => line.trim())
  expect(flagLines.map(indentOf)).toEqual([0, 2, 2, 2, 2])
})

test('reference code blocks dedent inline-authored samples correctly', async ({ page }) => {
  await page.goto('/docs/reference/coralite/')
  await page.waitForLoadState('networkidle')

  const block = page.locator('code-block').filter({ hasText: 'createCoralite' }).first()
  const lines = (await block.locator('pre').textContent()).split('\n').filter(line => line.trim())

  expect(lines.map(indentOf)).toEqual([0, 0, 2, 2, 2, 2, 0])
})
