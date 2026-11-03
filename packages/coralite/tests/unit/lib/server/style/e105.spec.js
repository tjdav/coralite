import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateComponentSource } from '../../../../../lib/server/component/validator.js'

describe('Style Validator (E105 and E303)', () => {
  test('Style function with ({ state }) => ... works without E105', () => {
    const code = `
      <template id="style-comp"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--accent': ({ state }) => state.active ? 'green' : 'gray'
          }
        })
      </script>
    `
    const result = validateComponentSource(code, 'style-comp.html')
    const e105s = result.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.strictEqual(e105s.length, 0)
  })

  test('Zero-arg function () => "4px" and static value are permitted without E105', () => {
    const code = `
      <template id="style-comp"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--static': () => '4px',
            '--gap': '1rem'
          }
        })
      </script>
    `
    const result = validateComponentSource(code, 'style-comp.html')
    const e105s = result.diagnostics.filter(d => d.code === 'CORALITE-E105')
    assert.strictEqual(e105s.length, 0)
  })

  test('Style function with (state) => ... emits CORALITE-E105 with migration message and fix action', () => {
    const code = `
      <template id="style-comp"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--accent': (state) => state.active ? 'green' : 'gray'
          }
        })
      </script>
    `
    const result = validateComponentSource(code, 'style-comp.html')
    const e105 = result.diagnostics.find(d => d.code === 'CORALITE-E105')
    assert.ok(e105, 'E105 diagnostic emitted for (state) => ... in style')
    assert.ok(e105.message.includes('Style function parameter receives CoraliteStyleContext'))
    assert.strictEqual(e105.fix?.action, 'style_context_migration')
  })

  test('Style function with (context) => context.state.active permits context parameter without E105', () => {
    const code = `
      <template id="style-comp"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--accent': (context) => context.state.active ? 'green' : 'gray'
          }
        })
      </script>
    `
    const result = validateComponentSource(code, 'style-comp.html')
    const e105 = result.diagnostics.find(d => d.code === 'CORALITE-E105')
    assert.strictEqual(e105, undefined)
  })

  test('Async style function async ({ state }) => ... emits CORALITE-E303', () => {
    const code = `
      <template id="style-comp"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--accent': async ({ state }) => state.active ? 'green' : 'gray'
          }
        })
      </script>
    `
    const result = validateComponentSource(code, 'style-comp.html')
    const e303 = result.diagnostics.find(d => d.code === 'CORALITE-E303')
    assert.ok(e303, 'E303 diagnostic emitted for async ({ state }) => ...')
  })

  test('Async style function async (state) => ... emits both CORALITE-E105 and CORALITE-E303', () => {
    const code = `
      <template id="style-comp"><div></div></template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--accent': async (state) => state.active ? 'green' : 'gray'
          }
        })
      </script>
    `
    const result = validateComponentSource(code, 'style-comp.html')
    const e105 = result.diagnostics.find(d => d.code === 'CORALITE-E105')
    const e303 = result.diagnostics.find(d => d.code === 'CORALITE-E303')
    assert.ok(e105, 'E105 emitted for old parameter signature')
    assert.ok(e303, 'E303 emitted for async style function')
  })
})
