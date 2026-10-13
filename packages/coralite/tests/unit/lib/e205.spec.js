import { describe, test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateComponentSource } from '../../../lib/server/component/validator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../../../../../tests/fixtures/components')

describe('CORALITE-E205: Template Token Resolution Pass', () => {
  test('emits CORALITE-E205 for template tokens that reference an undefined symbol', () => {
    const code = readFileSync(join(fixturesDir, 'token-undefined.html'), 'utf8')
    const result = validateComponentSource(code, 'token-undefined.html')

    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 1)
    assert.strictEqual(e205s[0].severity, 'error')
    assert.strictEqual(e205s[0].message, 'Template token "{{ title }}" does not resolve to any declared symbol.')
    assert.strictEqual(e205s[0].cause, 'Searched: attributes, state, getters, server return shape.')
  })

  test('does not emit CORALITE-E205 when token matches an attributes key', () => {
    const code = readFileSync(join(fixturesDir, 'token-resolves-attribute.html'), 'utf8')
    const result = validateComponentSource(code, 'token-resolves-attribute.html')

    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('does not emit CORALITE-E205 when token matches a getters key', () => {
    const code = readFileSync(join(fixturesDir, 'token-resolves-getter.html'), 'utf8')
    const result = validateComponentSource(code, 'token-resolves-getter.html')

    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('does not emit CORALITE-E205 when token matches a top-level state key', () => {
    const code = readFileSync(join(fixturesDir, 'token-resolves-state.html'), 'utf8')
    const result = validateComponentSource(code, 'token-resolves-state.html')

    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('does not emit CORALITE-E205 when token matches a server return key', () => {
    const code = readFileSync(join(fixturesDir, 'token-resolves-server.html'), 'utf8')
    const result = validateComponentSource(code, 'token-resolves-server.html')

    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('skips CORALITE-E205 when component state is computed', () => {
    const code = readFileSync(join(fixturesDir, 'token-unresolvable-state.html'), 'utf8')
    const result = validateComponentSource(code, 'token-unresolvable-state.html')

    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('skips CORALITE-E205 when server returns a non-literal expression', () => {
    const code = `
<template id="non-literal-server">
  <div>{{ title }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    async server() {
      const data = { title: 'Dynamic' }
      return data
    }
  })
</script>
`
    const result = validateComponentSource(code, 'non-literal-server.html')
    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('skips CORALITE-E205 for dotted token expressions', () => {
    const code = readFileSync(join(fixturesDir, 'token-dotted.html'), 'utf8')
    const result = validateComponentSource(code, 'token-dotted.html')

    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('skips CORALITE-E205 for reserved keywords', () => {
    const code = `
<template id="reserved-tokens">
  <div>{{ true }}</div>
  <div>{{ false }}</div>
  <div>{{ null }}</div>
  <div>{{ undefined }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    state: {
      count: 0
    }
  })
</script>
`
    const result = validateComponentSource(code, 'reserved-tokens.html')
    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('skips CORALITE-E205 when static component has no defineComponent call', () => {
    const code = `
<template id="static-card">
  <div>{{ title }}</div>
</template>
`
    const result = validateComponentSource(code, 'static-card.html')
    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })

  test('skips CORALITE-E205 when component has no state and no server block', () => {
    const code = `
<template id="no-state-no-server">
  <div>{{ title }}</div>
</template>

<script>
  import { defineComponent } from 'coralite'

  export default defineComponent({
    attributes: {
      label: String
    }
  })
</script>
`
    const result = validateComponentSource(code, 'no-state-no-server.html')
    const e205s = result.diagnostics.filter(d => d.code === 'CORALITE-E205')
    assert.strictEqual(e205s.length, 0)
  })
})
