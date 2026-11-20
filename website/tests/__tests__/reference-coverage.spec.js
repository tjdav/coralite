import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '../fixtures.js'

const ROOT = join(process.cwd(), '..')
const PAGES_DIR = join(process.cwd(), 'src/pages/reference')
const TYPES = join(ROOT, 'packages/coralite/types/component.js')
const PAGE_SOURCE = join(ROOT, 'packages/coralite/lib/shared/page.js')
const PLUGIN_VALIDATOR = join(ROOT, 'packages/coralite/lib/server/plugin/validator.js')

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
 * Page exports and the reference page that documents each one.
 */
const PAGE_EXPORT_PAGES = {
  paths: 'page-api',
  server: 'page-api',
  meta: 'page-api',
  getters: 'page-api',
  style: 'page-api',
  provide: 'page-api',
  client: 'page-api',
  onError: 'page-api'
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
 * Extracts names from a `new Set([...])` or array literal in a source file.
 * @param {string} source - File contents.
 * @param {string} declaration - Declaration prefix to locate.
 * @returns {string[]} Quoted names.
 */
function stringList (source, declaration) {
  const prefix = declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${prefix}[\\s\\S]*?\\[([\\s\\S]*?)\\]`))
  if (!match) {
    throw new Error(`${declaration} not found`)
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1])
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

test('every page export has a reference target', () => {
  const exports = stringList(readFileSync(PAGE_SOURCE, 'utf8'), 'export const PAGE_EXPORTS =')
  const undocumented = exports.filter((name) => !PAGE_EXPORT_PAGES[name])
  const source = readFileSync(join(PAGES_DIR, 'page-api.html'), 'utf8')
  const unnamed = exports.filter((name) => !new RegExp(`\\b${name}\\b`).test(source))

  expect(exports.length).toBeGreaterThan(0)
  expect(undocumented).toEqual([])
  expect(unnamed).toEqual([])
})

test('every plugin hook has a reference target', () => {
  const source = readFileSync(PLUGIN_VALIDATOR, 'utf8')
  const hooks = [
    ...stringList(source, 'const SERVER_HOOK_NAMES = new Set('),
    ...stringList(source, 'const CLIENT_HOOK_NAMES = new Set(')
  ]
  const page = readFileSync(join(PAGES_DIR, 'plugins.html'), 'utf8')
  const unnamed = hooks.filter((name) => !page.includes(name))

  expect(hooks.length).toBeGreaterThan(0)
  expect(unnamed).toEqual([])
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
