import { describe, it } from 'node:test'
import assert from 'node:assert'
import { applyPageFixes } from '#lib/server/page/fixer.js'

const FLAT_OPTIONS = {
  filePath: 'src/pages/example.html',
  migratePages: true
}

describe('Page Flat-Export Codemod (applyPageFixes)', () => {
  it('rewrites definePage configuration to flat named exports', () => {
    const input = `<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    async paths ({ app }) {
      return []
    },
    async server ({ route }) {
      return { title: route.path }
    },
    getters: {
      heading: ({ state }) => state.title
    },
    client ({ state }) {
      state.ready = true
    }
  })
</script>`

    const result = applyPageFixes(input, null, FLAT_OPTIONS)

    assert.strictEqual(result.modified, true)
    assert.match(result.outputCode, /export async function paths \(/)
    assert.match(result.outputCode, /export async function server \(/)
    assert.match(result.outputCode, /export const getters = \{/)
    assert.match(result.outputCode, /export function client \(/)
    assert.doesNotMatch(result.outputCode, /definePage/)
    assert.doesNotMatch(result.outputCode, /import \{ definePage \}/)
    assert.deepStrictEqual(result.skipped, [])
  })

  it('normalizes legacy bare const handlers to function declarations', () => {
    const input = `<script type="module">
  export const paths = async () => [{ id: 'one' }]
  export const server = async ({ route }) => ({ title: route.params.id })
</script>`

    const result = applyPageFixes(input, null, FLAT_OPTIONS)

    assert.strictEqual(result.modified, true)
    assert.match(result.outputCode, /export async function paths \(\) \{ return \[\{ id: 'one' \}\] \}/)
    assert.match(result.outputCode, /export async function server \(\{ route \}\) \{ return \{ title: route\.params\.id \} \}/)
    assert.doesNotMatch(result.outputCode, /export const paths/)
    assert.doesNotMatch(result.outputCode, /export const server/)
  })

  it('does nothing unless migratePages is enabled', () => {
    const input = `<script type="module">
  import { definePage } from 'coralite'
  export default definePage({ server () { return {} } })
</script>`

    const result = applyPageFixes(input, null, { filePath: 'src/pages/example.html' })

    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.outputCode, input)
  })

  it('bails with a reason when the definePage block contains comments', () => {
    const input = `<script type="module">
  import { definePage } from 'coralite'
  export default definePage({
    // keep me
    server () { return {} }
  })
</script>`

    const result = applyPageFixes(input, null, FLAT_OPTIONS)

    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.skipped.length, 1)
    assert.match(result.skipped[0], /comments/)
  })

  it('bails with a reason for identifier handler references', () => {
    const input = `<script type="module">
  import { definePage } from 'coralite'
  const run = async () => ({})
  export default definePage({ server: run })
</script>`

    const result = applyPageFixes(input, null, FLAT_OPTIONS)

    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.skipped.length, 1)
    assert.match(result.skipped[0], /not an inline function/)
  })

  it('bails with a reason for invalid page export names', () => {
    const input = `<script type="module">
  import { definePage } from 'coralite'
  export default definePage({ attributes: {} })
</script>`

    const result = applyPageFixes(input, null, FLAT_OPTIONS)

    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.skipped.length, 1)
    assert.match(result.skipped[0], /not a valid page export/)
  })

  it('rewrites a definePage meta block to a flat export', () => {
    const input = `<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    meta: {
      title: { type: String, default: 'Untitled' },
      count: { type: Number, default: 0 }
    }
  })
</script>`

    const result = applyPageFixes(input, null, FLAT_OPTIONS)

    assert.strictEqual(result.modified, true)
    assert.match(result.outputCode, /export const meta = \{/)
    assert.match(result.outputCode, /title: \{ type: String, default: 'Untitled' \}/)
    assert.doesNotMatch(result.outputCode, /definePage/)
    assert.deepStrictEqual(result.skipped, [])
  })

  it('is idempotent', () => {
    const input = `<script type="module">
  import { definePage } from 'coralite'
  export default definePage({ server () { return {} } })
</script>`

    const first = applyPageFixes(input, null, FLAT_OPTIONS)
    assert.strictEqual(first.modified, true)

    const second = applyPageFixes(first.outputCode, null, FLAT_OPTIONS)
    assert.strictEqual(second.modified, false)
  })
})
