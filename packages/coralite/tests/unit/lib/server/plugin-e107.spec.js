import { describe, it } from 'node:test'
import assert from 'node:assert'
import { definePlugin } from '../../../../lib/server/plugin/define.js'
import { validatePluginSource, validatePluginObject, validatePluginFile } from '../../../../lib/server/plugin/validator.js'
import { validateComponentSource } from '../../../../lib/server/component/validator.js'
import { extractPageScript } from '../../../../lib/server/parser/html.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('CORALITE-E107: Unified define* entry point block validation', () => {
  describe('definePlugin', () => {
    it('throws CORALITE-E107 when unknown top-level block is passed to definePlugin() at runtime', () => {
      assert.throws(
        () => definePlugin({
          name: 'test-plugin',
          unknownBlock: 'foo'
        }),
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-E107')
          assert.strictEqual(
            err.message,
            'Unknown block "unknownBlock" in definePlugin. Valid blocks are: name, config, server, client, dependencies, modes, rootDir, filePath.'
          )
          return true
        }
      )
    })

    it('emits CORALITE-E107 diagnostic in validatePluginSource for unknown top-level block', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'test-plugin',
          badOption: 123
        })
      `
      const res = validatePluginSource(source, 'test-plugin.js')
      assert.strictEqual(res.valid, false)
      const e107 = res.diagnostics.find(d => d.code === 'CORALITE-E107')
      assert.ok(e107)
      assert.strictEqual(
        e107.message,
        'Unknown block "badOption" in definePlugin. Valid blocks are: name, config, server, client, dependencies, modes, rootDir, filePath.'
      )
    })

    it('emits CORALITE-E107 diagnostic in validatePluginObject for unknown top-level block', () => {
      const pluginObj = {
        name: 'test-plugin',
        extraField: true
      }
      const res = validatePluginObject(pluginObj, 'test-plugin.js')
      assert.strictEqual(res.valid, false)
      const e107 = res.diagnostics.find(d => d.code === 'CORALITE-E107')
      assert.ok(e107)
      assert.strictEqual(
        e107.message,
        'Unknown block "extraField" in definePlugin. Valid blocks are: name, config, server, client, dependencies, modes, rootDir, filePath.'
      )
    })

    it('validates plugin fixture with rejected block on disk', async () => {
      const fixturePath = join(__dirname, '../../../fixtures/plugins/rejected-block.js')
      const res = await validatePluginFile(fixturePath)
      assert.strictEqual(res.valid, false)
      const e107 = res.diagnostics.find(d => d.code === 'CORALITE-E107')
      assert.ok(e107)
      assert.strictEqual(
        e107.message,
        'Unknown block "unknownOption" in definePlugin. Valid blocks are: name, config, server, client, dependencies, modes, rootDir, filePath.'
      )
    })

    it('accepts dependencies and all valid blocks without emitting CORALITE-E107', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'full-plugin',
          config: {},
          server: {},
          client: {},
          dependencies: ['other-plugin'],
          modes: ['development'],
          rootDir: '/app',
          filePath: '/app/plugin.js'
        })
      `
      const res = validatePluginSource(source, 'full-plugin.js')
      const e107s = res.diagnostics.filter(d => d.code === 'CORALITE-E107')
      assert.strictEqual(e107s.length, 0)
    })
  })

  describe('defineComponent', () => {
    it('emits CORALITE-E107 with defineComponent message for unknown key', () => {
      const code = `
        <template id="test-comp"><div>Test</div></template>
        <script>
          import { defineComponent } from 'coralite'
          export default defineComponent({
            unknownProp: 'hello'
          })
        </script>
      `
      const res = validateComponentSource(code, 'test-comp.html')
      const e107 = res.diagnostics.find(d => d.code === 'CORALITE-E107')
      assert.ok(e107)
      assert.strictEqual(
        e107.message,
        'Unknown block "unknownProp" in defineComponent. Valid blocks are: attributes, server, getters, style, slots, provide, consume, client, formAssociated, formControl, reconcile, listStrategy, key, onError.'
      )
    })

    it('accepts all valid blocks in defineComponent without emitting CORALITE-E107', () => {
      const code = `
        <template id="valid-comp"><slot name="default"></slot></template>
        <script>
          import { defineComponent } from 'coralite'
          export default defineComponent({
            attributes: { text: { type: String } },
            server: async () => ({ count: 1 }),
            getters: { doubleCount: ({ state }) => state.count * 2 },
            style: { color: () => 'red' },
            slots: { default: () => 'slot' },
            provide: { theme: 'dark' },
            consume: ['lang'],
            client: () => {},
            formAssociated: false,
            onError: () => {}
          })
        </script>
      `
      const res = validateComponentSource(code, 'valid-comp.html')
      const e107s = res.diagnostics.filter(d => d.code === 'CORALITE-E107')
      assert.strictEqual(e107s.length, 0)
    })
  })

  describe('definePage', () => {
    it('emits CORALITE-E107 with definePage message for unknown key', () => {
      const html = `
        <script>
          import { definePage } from 'coralite'
          export default definePage({
            unknownPageBlock: true
          })
        </script>
      `
      assert.throws(
        () => extractPageScript(html, { filePath: 'index.html' }),
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-E107')
          assert.strictEqual(
            err.message,
            'Unknown block "unknownPageBlock" in definePage. Valid blocks are: paths, server, getters, style, provide, client, onError.'
          )
          return true
        }
      )
    })

    it('emits CORALITE-E107 with specific alternative message for rejected page blocks', () => {
      const cases = [
        {
          key: 'attributes',
          expected: 'definePage does not support "attributes". Use "server" to fetch page data.'
        },
        {
          key: 'slots',
          expected: 'definePage does not support "slots". Pages are the outermost layer.'
        },
        {
          key: 'consume',
          expected: 'definePage does not support "consume". Pages are the root provider — use "provide".'
        },
        {
          key: 'formAssociated',
          expected: 'definePage does not support "formAssociated". Use a form-associated component instead.'
        }
      ]

      for (const { key, expected } of cases) {
        const html = `
          <script>
            import { definePage } from 'coralite'
            export default definePage({
              ${key}: {}
            })
          </script>
        `
        assert.throws(
          () => extractPageScript(html, { filePath: 'page.html' }),
          (err) => {
            assert.strictEqual(err.code, 'CORALITE-E107')
            assert.strictEqual(err.message, expected)
            return true
          }
        )
      }
    })

    it('accepts all valid blocks in definePage without emitting CORALITE-E107', () => {
      const html = `
        <script>
          import { definePage } from 'coralite'
          export default definePage({
            paths: () => [],
            server: async () => ({ title: 'Page' }),
            getters: { pageTitle: ({ state }) => state.title },
            style: { background: () => 'white' },
            provide: { pageCtx: true },
            client: () => {},
            onError: () => {}
          })
        </script>
      `
      const res = extractPageScript(html, { filePath: 'valid.html' })
      assert.strictEqual(res.hasDefinePage, true)
    })
  })
})
