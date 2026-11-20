import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '../fixtures.js'

const PAGES_DIR = join(process.cwd(), 'src/pages')

/**
 * Lists page files below a directory.
 * @param {string} dir - Directory to walk.
 * @returns {string[]} Absolute file paths.
 */
function listPages (dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listPages(target))
    } else if (entry.name.endsWith('.html')) {
      files.push(target)
    }
  }
  return files
}

test('multi-line code-block content starts on a new line', () => {
  const issues = []

  for (const file of listPages(PAGES_DIR)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/<code-block\b[^>]*>([\s\S]*?)<\/code-block>/g)) {
      const body = match[1]
      if (!body.includes('\n') || body.startsWith('\n')) {
        continue
      }
      const line = source.slice(0, match.index).split('\n').length
      issues.push(`${file}:${line} starts multi-line code-block content inline`)
    }
  }

  expect(issues).toEqual([])
})
