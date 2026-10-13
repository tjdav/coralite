import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { applyComponentFixes } from '../../../../../lib/server/component/fixer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../../fixtures/components/style-migration')

describe('Style Fixer (style_context_migration)', () => {
  test('coralite fix rewrites (state) => state.x to ({ state }) => state.x', async () => {
    const beforeCode = await readFile(join(fixturesDir, 'before.html'), 'utf8')
    const expectedCode = await readFile(join(fixturesDir, 'expected.html'), 'utf8')

    const result = applyComponentFixes(beforeCode, null, { filePath: 'style-migration/before.html' })
    assert.strictEqual(result.modified, true)
    assert.strictEqual(result.outputCode, expectedCode)
  })

  test('coralite fix does not touch zero-arg functions or already destructured parameters', () => {
    const input = `
      <template id="test-comp"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--gap': () => '1rem',
            '--color': ({ state }) => state.active ? 'green' : 'red'
          }
        })
      </script>
    `
    const result = applyComponentFixes(input, null, { filePath: 'test-comp.html' })
    assert.strictEqual(result.modified, false)
    assert.strictEqual(result.outputCode, input)
  })
})
