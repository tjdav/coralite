import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyPageFixes } from '#lib/server/page/fixer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../../fixtures/pages/codemod')

describe('Page Bare-Exports Codemod (applyPageFixes)', () => {
  it('rewrites paths-only bare export to definePage({ paths: ... })', async () => {
    const input = await readFile(join(fixturesDir, 'before-paths-only.html'), 'utf8')
    const expected = await readFile(join(fixturesDir, 'expected-paths-only.html'), 'utf8')

    const result = applyPageFixes(input, null, { filePath: 'packages/coralite/tests/fixtures/pages/codemod/before-paths-only.html' })
    assert.strictEqual(result.modified, true)
    assert.strictEqual(result.outputCode, expected)
    assert.strictEqual(result.fixesApplied.length, 1)
    assert.strictEqual(result.fixesApplied[0].code, 'CORALITE-E108')
  })

  it('rewrites server-only bare export to definePage({ server: ... })', async () => {
    const input = await readFile(join(fixturesDir, 'before-server-only.html'), 'utf8')
    const expected = await readFile(join(fixturesDir, 'expected-server-only.html'), 'utf8')

    const result = applyPageFixes(input, null, { filePath: 'packages/coralite/tests/fixtures/pages/codemod/before-server-only.html' })
    assert.strictEqual(result.modified, true)
    assert.strictEqual(result.outputCode, expected)
  })

  it('rewrites both bare exports to definePage({ paths, server })', async () => {
    const input = await readFile(join(fixturesDir, 'before-both.html'), 'utf8')
    const expected = await readFile(join(fixturesDir, 'expected-both.html'), 'utf8')

    const result = applyPageFixes(input, null, { filePath: 'packages/coralite/tests/fixtures/pages/codemod/before-both.html' })
    assert.strictEqual(result.modified, true)
    assert.strictEqual(result.outputCode, expected)
  })

  it('preserves top-level code and imports when converting bare exports', async () => {
    const input = await readFile(join(fixturesDir, 'before-with-imports.html'), 'utf8')
    const expected = await readFile(join(fixturesDir, 'expected-with-imports.html'), 'utf8')

    const result = applyPageFixes(input, null, { filePath: 'packages/coralite/tests/fixtures/pages/codemod/before-with-imports.html' })
    assert.strictEqual(result.modified, true)
    assert.strictEqual(result.outputCode, expected)
  })

  it('does not duplicate import { definePage } if already present', () => {
    const input = `<script type="module">\n  import { definePage } from 'coralite'\n  export const paths = () => []\n</script>`
    const result = applyPageFixes(input, null, { filePath: 'already-imported.html' })
    assert.strictEqual(result.modified, true)
    assert.strictEqual((result.outputCode.match(/import { definePage }/g) || []).length, 1)
  })

  it('skips files carrying <!-- coralite-ignore E108 -->', async () => {
    const input = await readFile(join(fixturesDir, 'before-ignore-pragma.html'), 'utf8')
    const result = applyPageFixes(input, null, { filePath: 'before-ignore-pragma.html' })
    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.outputCode, input)
  })

  it('skips files in tests/fixtures/ directory unless under codemod', () => {
    const input = `<script type="module">\n  export const paths = () => []\n</script>`
    const result = applyPageFixes(input, null, { filePath: 'packages/coralite/tests/fixtures/pages/bare-exports.html' })
    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.outputCode, input)
  })

  it('skips files with no bare exports', () => {
    const input = `<script type="module">\n  import { definePage } from 'coralite'\n  export default definePage({ server: () => ({}) })\n</script>`
    const result = applyPageFixes(input, null, { filePath: 'valid-page.html' })
    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.outputCode, input)
  })
})
