import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyComponentFixes } from '../../../../../lib/server/component/fixer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationDir = join(__dirname, '../../../../fixtures/components/slots-migration')

test('slots_context_migration - Codemod fixer', async (t) => {
  await t.test('rewrites (nodes, { state }) and (content, { state }) to ({ nodes, state })', () => {
    const beforeCode = readFileSync(join(migrationDir, 'before.html'), 'utf8')
    const expectedCode = readFileSync(join(migrationDir, 'expected.html'), 'utf8')

    const fixRes = applyComponentFixes(beforeCode, null, { filePath: 'before.html' })
    assert.equal(fixRes.modified, true)
    assert.equal(fixRes.outputCode.trim(), expectedCode.trim())
    assert.equal(fixRes.fixesApplied.filter(f => f.code === 'CORALITE-E105').length, 2)
  })

  await t.test('does not touch zero-parameter or already-new-form slots functions', () => {
    const code = `<template id="x-already-new"><div><slot></slot></div></template>
<script>
import { defineComponent } from 'coralite'
export default defineComponent({
  slots: {
    a: () => undefined,
    b: ({ nodes, state }) => nodes
  }
})
</script>`

    const fixRes = applyComponentFixes(code, null, { filePath: 'already-new.html' })
    assert.equal(fixRes.modified, false)
    assert.equal(fixRes.outputCode, code)
  })
})
