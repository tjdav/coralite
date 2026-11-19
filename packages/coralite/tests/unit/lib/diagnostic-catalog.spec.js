import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DIAGNOSTIC_CATALOG } from '../../../lib/shared/diagnostic-catalog.js'

const LIB_DIR = resolve(import.meta.dirname, '../../../lib')
const CATALOG_FILE = join(LIB_DIR, 'shared/diagnostic-catalog.js')
const FAMILIES = new Set(['component', 'plugin', 'page', 'accessibility', 'config'])
const SEVERITIES = new Set(['error', 'warning'])

/**
 * Recursively lists JavaScript files below a directory.
 * @param {string} dir - Directory to walk.
 * @returns {string[]} Absolute file paths.
 */
function listSources (dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const target = join(dir, entry)
    if (statSync(target).isDirectory()) {
      files.push(...listSources(target))
    } else if (entry.endsWith('.js')) {
      files.push(target)
    }
  }
  return files
}

/**
 * Collects every diagnostic code the runtime can emit.
 * @returns {Set<string>} Emitted codes.
 */
function emittedCodes () {
  const codes = new Set()
  for (const file of listSources(LIB_DIR)) {
    if (file === CATALOG_FILE) {
      continue
    }
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/code:\s*'(CORALITE-[A-Z]+-?[0-9]+)'/g)) {
      codes.add(match[1])
    }
  }
  return codes
}

describe('diagnostic catalogue', () => {
  it('documents every emitted diagnostic code and nothing more', () => {
    const catalogued = new Set(DIAGNOSTIC_CATALOG.map(entry => entry.code))
    const emitted = emittedCodes()

    const missing = [...emitted].filter(code => !catalogued.has(code)).sort()
    const extra = [...catalogued].filter(code => !emitted.has(code)).sort()

    assert.deepEqual(missing, [], `Codes emitted but missing from the catalog: ${missing.join(', ')}`)
    assert.deepEqual(extra, [], `Codes catalogued but never emitted: ${extra.join(', ')}`)
  })

  it('keeps entries unique and fully described', () => {
    const seen = new Set()
    for (const entry of DIAGNOSTIC_CATALOG) {
      assert.match(entry.code, /^CORALITE-[A-Z]+-?\d+$/)
      assert.equal(seen.has(entry.code), false, `Duplicate catalog entry: ${entry.code}`)
      seen.add(entry.code)

      assert.equal(FAMILIES.has(entry.family), true, `${entry.code} has unknown family ${entry.family}`)
      assert.equal(SEVERITIES.has(entry.severity), true, `${entry.code} has unknown severity ${entry.severity}`)
      assert.equal(typeof entry.fixable, 'boolean', `${entry.code} must declare fixable`)
      assert.equal(typeof entry.title, 'string', `${entry.code} is missing a title`)
      assert.equal(entry.title.length > 0, true, `${entry.code} has an empty title`)
      assert.equal(entry.summary.length > 0, true, `${entry.code} has an empty summary`)
      assert.equal(entry.fix.length > 0, true, `${entry.code} has an empty fix`)

      if (entry.fixable) {
        assert.equal(Array.isArray(entry.fixActions) && entry.fixActions.length > 0, true, `${entry.code} is fixable without fixActions`)
      } else {
        assert.equal(entry.fixActions, undefined, `${entry.code} is not fixable but declares fixActions`)
      }
    }
  })
})
