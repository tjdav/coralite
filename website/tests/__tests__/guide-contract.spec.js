import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '../fixtures.js'

const GUIDE_DIR = join(process.cwd(), 'src/pages/docs/guide')
const SIDEBAR = join(process.cwd(), 'src/components/docs-sidebar.html')
const INDEX = join(GUIDE_DIR, 'index.html')

/**
 * Lists guide page files.
 * @returns {string[]} Absolute file paths, excluding the hub.
 */
function guideFiles () {
  return readdirSync(GUIDE_DIR)
    .filter((file) => file.endsWith('.html') && file !== 'index.html')
    .map((file) => join(GUIDE_DIR, file))
}

/**
 * Extracts code sample bodies with their filename attribute.
 * @param {string} source - Page source.
 * @returns {Array<{ body: string, filename: string, offset: number }>} Samples.
 */
function codeSamples (source) {
  return [...source.matchAll(/<code-block\b([^>]*)>([\s\S]*?)<\/code-block>/g)].map((match) => ({
    body: match[2],
    filename: (match[1].match(/filename="([^"]*)"/) || [])[1] || '',
    offset: match.index
  }))
}

/**
 * Formats a source location.
 * @param {string} file - File path.
 * @param {string} source - Full source.
 * @param {number} offset - Offset in the source.
 * @returns {string} Human-readable location.
 */
function location (file, source, offset) {
  return `${file}:${source.slice(0, offset).split('\n').length}`
}

test('guides contain no roadmap or planned-feature language', () => {
  const issues = []
  const pattern = /\b(planned|coming soon|future release|roadmap)\b/gi

  for (const file of guideFiles()) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(pattern)) {
      issues.push(`${location(file, source, match.index)} contains "${match[0]}"`)
    }
  }

  expect(issues).toEqual([])
})

test('guide samples use flat named exports', () => {
  const issues = []
  const pattern = /export\s+default\s+define(?:Component|Page)\s*\(/g

  for (const file of guideFiles()) {
    const source = readFileSync(file, 'utf8')
    for (const sample of codeSamples(source)) {
      for (const _match of sample.body.matchAll(pattern)) {
        issues.push(`${location(file, source, sample.offset)} still uses a legacy wrapper`)
      }
    }
  }

  expect(issues).toEqual([])
})

test('guide samples use flat template tokens', () => {
  const issues = []

  for (const file of guideFiles()) {
    const source = readFileSync(file, 'utf8')
    for (const sample of codeSamples(source)) {
      if (/incorrect|bad/i.test(sample.filename)) {
        continue
      }
      for (const match of sample.body.matchAll(/\{\{[^}]*\.[^}]*\}\}/g)) {
        issues.push(`${location(file, source, sample.offset)} uses a dotted token: ${match[0]}`)
      }
    }
  }

  expect(issues).toEqual([])
})

test('guides do not use removed APIs', () => {
  const issues = []
  const patterns = [
    /app\.collections/g,
    /routePath/g,
    /(^|\n)\s*data\s*\(/g
  ]

  for (const file of guideFiles()) {
    const source = readFileSync(file, 'utf8')
    for (const sample of codeSamples(source)) {
      for (const pattern of patterns) {
        for (const match of sample.body.matchAll(pattern)) {
          issues.push(`${location(file, source, sample.offset)} uses a removed API: ${match[0].trim()}`)
        }
      }
    }
  }

  expect(issues).toEqual([])
})

test('every guide page is linked from the sidebar and the hub', () => {
  const sidebar = readFileSync(SIDEBAR, 'utf8')
  const index = readFileSync(INDEX, 'utf8')
  const missing = []

  for (const file of guideFiles()) {
    const slug = file.split('/').pop().replace(/\.html$/, '')
    if (!sidebar.includes(`/docs/guide/${slug}/`)) {
      missing.push(`${slug}.html is missing from docs-sidebar`)
    }
    if (!index.includes(`/docs/guide/${slug}/`)) {
      missing.push(`${slug}.html is missing from the guide hub`)
    }
  }

  expect(missing).toEqual([])
})
