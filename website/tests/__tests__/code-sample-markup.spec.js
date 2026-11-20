import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '../fixtures.js'

const PAGES_DIR = join(process.cwd(), 'src/pages')
const COMPONENTS_DIR = join(process.cwd(), 'src/components')

const HTML_TAGS = new Set(`a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr svg path g rect circle line polyline polygon defs lineargradient stop use symbol clippath`.split(' '))

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

/**
 * Collects component tag names declared by the site.
 * @returns {Set<string>} Registered component tags.
 */
function componentTags () {
  const tags = new Set()
  for (const entry of readdirSync(COMPONENTS_DIR)) {
    if (!entry.endsWith('.html')) {
      continue
    }
    const source = readFileSync(join(COMPONENTS_DIR, entry), 'utf8')
    const match = source.match(/<template\s+[^>]*id="([^"]+)"/)
    if (match) {
      tags.add(match[1])
    }
  }
  return tags
}

/**
 * Reports literal angle brackets in a code sample that the HTML parser will
 * treat as elements, e.g. TypeScript generics like `<void>`.
 * @param {string} body - Code sample contents.
 * @param {string} file - Source file, for the report.
 * @param {string} source - Full source, for line numbers.
 * @param {number} offset - Sample start offset in the source.
 * @param {Set<string>} components - Registered component tags.
 * @returns {string[]} Problem descriptions.
 */
function problems (body, file, source, offset, components) {
  const found = []
  for (const match of body.matchAll(/<([A-Za-z][\w-]*)/g)) {
    const name = match[1]
    const known = HTML_TAGS.has(name.toLowerCase()) ||
      components.has(name) ||
      name === 'coralite-version' ||
      name.includes('-')
    if (known) {
      continue
    }
    const line = source.slice(0, offset + match.index).split('\n').length
    found.push(`${file}:${line} literal <${name}> inside a code sample`)
  }
  return found
}

test('code samples escape literal angle brackets', () => {
  const components = componentTags()
  const issues = []

  for (const file of listPages(PAGES_DIR)) {
    const source = readFileSync(file, 'utf8')
    const samples = [
      ...source.matchAll(/<code-block\b[^>]*>([\s\S]*?)<\/code-block>/g),
      ...source.matchAll(/<code>([\s\S]*?)<\/code>/g)
    ]

    for (const sample of samples) {
      issues.push(...problems(sample[1], file, source, sample.index, components))
    }
  }

  expect(issues).toEqual([])
})
