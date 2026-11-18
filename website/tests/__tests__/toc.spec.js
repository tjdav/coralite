import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../fixtures.js'

const pagesDir = path.resolve('src/pages')

function collectPages (dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectPages(full, result)
    else if (entry.name.endsWith('.html')) result.push(full)
  }
  return result
}

test('every in-page anchor resolves to a unique id', () => {
  const problems = []

  for (const file of collectPages(pagesDir)) {
    const source = fs.readFileSync(file, 'utf8')
    if (!source.includes('href="#')) continue

    const codeRanges = [...source.matchAll(/<code-block\b[^>]*>[\s\S]*?<\/code-block>/g)]
      .map(match => [match.index, match.index + match[0].length])

    const inCode = (index) => codeRanges.some(([start, end]) => index >= start && index < end)

    const ids = []
    for (const match of source.matchAll(/\bid="([^"]+)"/g)) {
      if (inCode(match.index)) continue
      ids.push(match[1])
    }
    const idSet = new Set(ids)

    if (idSet.size !== ids.length) {
      problems.push(`${path.relative(pagesDir, file)}: duplicate ids`)
    }

    for (const match of source.matchAll(/<a\b[^>]*href="#([^"]+)"/g)) {
      if (inCode(match.index)) continue
      if (!idSet.has(match[1])) {
        problems.push(`${path.relative(pagesDir, file)}: missing target #${match[1]}`)
      }
    }
  }

  expect(problems).toEqual([])
})

test('TOC follows the scroll position and links jump to their section', async ({ page }) => {
  await page.goto('/reference/client')
  await page.waitForLoadState('networkidle')

  const links = page.locator('.docs-toc a')
  const count = await links.count()
  expect(count).toBeGreaterThan(0)

  const targets = await links.evaluateAll(anchors => anchors.map(anchor => anchor.getAttribute('href')))
  for (const target of targets) {
    await expect(page.locator(target)).toHaveCount(1)
  }

  await page.locator('.docs-toc a[href="#observing-state"]').click()
  await expect(page).toHaveURL(/#observing-state$/)
  await expect(page.locator('.docs-toc a[href="#observing-state"]')).toHaveClass(/active/)
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator('.docs-toc a[href="#typescript-signature"]')).toHaveClass(/active/)
  await expect(page.locator('.docs-toc a.active')).toHaveCount(1)
})
