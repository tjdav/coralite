import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateComponentSource } from '../../../../../lib/server/component/validator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../../fixtures/components')

test('CORALITE-E105 - Slots function signature validation', async (t) => {
  await t.test('fires CORALITE-E105 for two-parameter old signature (nodes, { state })', () => {
    const fixturePath = join(fixturesDir, 'slots-old-signature.html')
    const sourceCode = readFileSync(fixturePath, 'utf8')
    const res = validateComponentSource(sourceCode, fixturePath)

    const e105Diags = res.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.equal(e105Diags.length, 1)
    assert.match(e105Diags[0].message, /slots functions must receive a single destructured context/)
    assert.match(e105Diags[0].message, /Expected: \({ nodes, state }\) => \.\.\./)
    assert.match(e105Diags[0].message, /Found:    \(nodes, \{ state \}\) => \.\.\./)
    assert.equal(e105Diags[0].fix?.action, 'slots_context_migration')
  })

  await t.test('fires CORALITE-E105 for single identifier parameter (context)', () => {
    const fixturePath = join(fixturesDir, 'slots-identifier-param.html')
    const sourceCode = readFileSync(fixturePath, 'utf8')
    const res = validateComponentSource(sourceCode, fixturePath)

    const e105Diags = res.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.equal(e105Diags.length, 1)
    assert.match(e105Diags[0].message, /slots functions must receive a single destructured context/)
    assert.match(e105Diags[0].message, /Found:    \(context\) => \.\.\./)
    assert.equal(e105Diags[0].fix, null)
  })

  await t.test('permits new single destructured context form ({ nodes, state })', () => {
    const fixturePath = join(fixturesDir, 'slots-new-signature.html')
    const sourceCode = readFileSync(fixturePath, 'utf8')
    const res = validateComponentSource(sourceCode, fixturePath)

    const e105Diags = res.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.equal(e105Diags.length, 0)
  })

  await t.test('permits zero-parameter slots function () => undefined', () => {
    const fixturePath = join(fixturesDir, 'slots-zero-arg.html')
    const sourceCode = readFileSync(fixturePath, 'utf8')
    const res = validateComponentSource(sourceCode, fixturePath)

    const e105Diags = res.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.equal(e105Diags.length, 0)
  })
})
