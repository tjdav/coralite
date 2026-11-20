import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '../fixtures.js'

const ROOT = join(process.cwd(), '..')
const PAGES_DIR = join(process.cwd(), 'src/pages/reference')
const TYPES = join(ROOT, 'packages/coralite/types/component.js')

/**
 * Component exports and the reference page that documents each one.
 * Adding an export to CoraliteComponentExports without a target fails the spec.
 */
const COMPONENT_PAGES = {
  attributes: 'attributes',
  server: 'server',
  getters: 'getters',
  style: 'style',
  slots: 'slots',
  provide: 'provide-consume',
  consume: 'provide-consume',
  formControl: 'form-control',
  listStrategy: 'list-strategy',
  onError: 'on-error',
  client: 'client'
}

/**
 * Extracts the component export names from the published type declarations.
 * @returns {string[]} Export names.
 */
function componentExports () {
  const source = readFileSync(TYPES, 'utf8')
  const block = source.match(/@typedef \{Object\} CoraliteComponentExports[\s\S]*?(?=\n\/\*\*)/)
  if (!block) {
    throw new Error('CoraliteComponentExports typedef not found')
  }
  const names = []
  for (const line of block[0].split('\n')) {
    if (!line.trimStart().startsWith('* @property')) {
      continue
    }
    const match = line.match(/\[(\w+)\]$/)
    if (match) {
      names.push(match[1])
    }
  }
  return names
}

/**
 * Lists the reference page slugs that exist on disk.
 * @returns {string[]} Page slugs.
 */
function referencePages () {
  return readdirSync(PAGES_DIR)
    .filter((file) => file.endsWith('.html') && file !== 'index.html')
    .map((file) => file.replace(/\.html$/, ''))
}

test('every component export has a reference page', () => {
  const missing = []
  const undocumented = []

  for (const name of componentExports()) {
    const slug = COMPONENT_PAGES[name]
    if (!slug) {
      missing.push(`${name} has no reference page target`)
      continue
    }
    const source = readFileSync(join(PAGES_DIR, `${slug}.html`), 'utf8')
    if (!new RegExp(`\\b${name}\\b`).test(source)) {
      undocumented.push(`${name} is mapped to ${slug}.html but never named on it`)
    }
  }

  const stale = Object.keys(COMPONENT_PAGES).filter((name) => !componentExports().includes(name))

  expect(missing).toEqual([])
  expect(undocumented).toEqual([])
  expect(stale).toEqual([])
})

test('every reference page is linked from the shared sidebar', () => {
  const sidebar = readFileSync(join(process.cwd(), 'src/components/reference-sidebar.html'), 'utf8')
  const unlinked = referencePages().filter((slug) => !sidebar.includes(`/reference/${slug}/`))
  expect(unlinked).toEqual([])
})

test('reference pages use the shared sidebar instead of local markup', () => {
  const local = []
  for (const slug of referencePages()) {
    const source = readFileSync(join(PAGES_DIR, `${slug}.html`), 'utf8')
    if (!source.includes('<reference-sidebar slot="sidebar">')) {
      local.push(`${slug}.html does not use reference-sidebar`)
    }
    if (source.includes('<ui-accordion')) {
      local.push(`${slug}.html still renders its own sidebar markup`)
    }
  }
  expect(local).toEqual([])
})
