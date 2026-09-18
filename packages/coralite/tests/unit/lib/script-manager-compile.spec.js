import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { ScriptManager as OriginalScriptManager } from '../../../lib/script-manager.js'

const activeManagers = []
class ScriptManager extends OriginalScriptManager {
  constructor (...args) {
    super(...args)
    activeManagers.push(this)
  }
}

describe('ScriptManager Compilation', () => {
  afterEach(async () => {
    for (const sm of activeManagers) {
      await sm.disposeContext()
    }
    activeManagers.length = 0
  })

  describe('getClientContextContent() - Client Context Retrieval', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should return empty object string when no context props', () => {
      const result = sm.getClientContextContent()
      assert.strictEqual(result, '')
    })

    it('should return formatted context string', async () => {
      await sm.addContextProp('helper1', () => 'test1')
      await sm.addContextProp('helper2', (x) => x * 2)

      const result = sm.getClientContextContent()

      assert.ok(result.includes('"helper1": async (globalContext) =>'))
      assert.ok(result.includes('() => \'test1\''))
      assert.ok(result.includes('"helper2": async (globalContext) =>'))
      assert.ok(result.includes('(x) => x * 2'))
    })

    it('should handle multiple context', async () => {
      await sm.addContextProp('a', () => 1)
      await sm.addContextProp('b', () => 2)
      await sm.addContextProp('c', () => 3)

      const result = sm.getClientContextContent()

      assert.ok(result.includes('"a":'))
      assert.ok(result.includes('"b":'))
      assert.ok(result.includes('"c":'))
    })

    it('should handle context with special characters in names', async () => {
      await sm.addContextProp('$private', () => 'private')
      await sm.addContextProp('_internal', () => 'internal')

      const result = sm.getClientContextContent()

      assert.ok(result.includes('"$private":'))
      assert.ok(result.includes('"_internal":'))
    })

    it('should ignore context parameter (for compatibility)', async () => {
      await sm.addContextProp('test', () => 'value')

      const result1 = sm.getClientContextContent()
      const result2 = sm.getClientContextContent()

      assert.strictEqual(result1, result2)
    })
  })

  describe('addContextProp() Validation', () => {
    it('should throw CoraliteError if name is invalid or empty', async () => {
      const sm = new ScriptManager()
      await assert.rejects(
        async () => { await sm.addContextProp('', () => {}) },
        /addContextProp requires a non-empty string name/
      )
      await assert.rejects(
        async () => { await sm.addContextProp('   ', () => {}) },
        /addContextProp requires a non-empty string name/
      )
      await assert.rejects(
        async () => { await sm.addContextProp(null, () => {}) },
        /addContextProp requires a non-empty string name/
      )
    })
  })

  describe('compileComponents() - Full Compilation', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should compile single component', async () => {
      sm.registerComponent({
        id: 'test',
        script: {
          content: `({ double, values }) => {
            return context.values.count * 2
          }`
        }
      })

      const result = await sm.compileComponents('production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['test'])
    })

    it('should handle empty registered components', async () => {
      const result = await sm.compileComponents('production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['coralite-runtime'])
    })

    it('should handle async shared functions', async () => {
      sm.registerComponent({
        id: 'async',
        script: {
          content: `async ({ double, values }) => {
            await Promise.resolve()
            return context.values.x
          }`
        }
      })

      const result = await sm.compileComponents('production')

      assert.ok(typeof result === 'object')
      const chunkHash = result.manifest['async'].js
      assert.ok(result.outputFiles[chunkHash].text.includes('async'))
    })

    it('should handle complex instance contexts', async () => {
      await sm.addContextProp('format', () => () => (value) => {
        return `instance-id: ${value}`
      })

      sm.registerComponent({
        id: 'complex',
        script: {
          content: `({ double, values }) => {
            const formatter = context.format()
            return formatter(context.values.message)
          }`
        }
      })

      const result = await sm.compileComponents('production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['complex'])
    })

    it('should produce valid JavaScript', async () => {
      sm.registerComponent({
        id: 'test',
        script: { content: '(context) => context.values.x' }
      })

      const result = await sm.compileComponents('production')

      assert.ok(result.manifest['test'])
    })

    it('should reset esbuild context in development if entry points change', async () => {
      sm.registerComponent({
        id: 'comp-1',
        script: { content: '() => {}' }
      })

      // First compilation
      await sm.compileComponents('development')
      const firstContext = sm.context

      // Register new component
      sm.registerComponent({
        id: 'comp-2',
        script: { content: '() => {}' }
      })

      // Second compilation
      const result = await sm.compileComponents('development')

      assert.notStrictEqual(sm.context, firstContext, 'Esbuild context should have been reset')
      assert.ok(result.manifest['comp-1'], 'Manifest should contain comp-1')
      assert.ok(result.manifest['comp-2'], 'Manifest should contain comp-2')
    })

    it('should bundle all registered components for imperative loading', async () => {
      sm.registerComponent({
        id: 'declarative',
        script: { content: '() => {}' }
      })

      sm.registerComponent({
        id: 'imperative',
        script: { content: '() => {}' }
      })

      const result = await sm.compileComponents('production')

      assert.ok(result.manifest['declarative'], 'Declarative component should be in manifest')
      assert.ok(result.manifest['imperative'], 'Imperative component should be in manifest')
    })

    it('should handle nested imperative components by bundling all registered components', async () => {
      sm.registerComponent({
        id: 'parent',
        script: { content: '() => {}' },
        components: ['child']
      })

      sm.registerComponent({
        id: 'child',
        script: { content: '() => {}' },
        components: ['grand-child']
      })

      sm.registerComponent({
        id: 'grand-child',
        script: { content: '() => {}' }
      })

      const result = await sm.compileComponents('production')

      assert.ok(result.manifest['parent'], 'Parent should be in manifest')
      assert.ok(result.manifest['child'], 'Child should be in manifest')
      assert.ok(result.manifest['grand-child'], 'Grand-child should be in manifest')
    })

    it('Component Identifier Collision Resilience: registers my-comp, my_comp, and my.comp simultaneously', async () => {
      sm.registerComponent({
        id: 'my-comp',
        script: { content: '() => "comp-dash"' }
      })
      sm.registerComponent({
        id: 'my_comp',
        script: { content: '() => "comp-underscore"' }
      })
      sm.registerComponent({
        id: 'my.comp',
        script: { content: '() => "comp-dot"' }
      })

      const result = await sm.compileComponents('production')

      assert.ok(result.manifest['my-comp'], 'my-comp should be in manifest')
      assert.ok(result.manifest['my_comp'], 'my_comp should be in manifest')
      assert.ok(result.manifest['my.comp'], 'my.comp should be in manifest')

      assert.ok(result.outputFiles[result.manifest['my-comp'].js].text.includes('comp-dash'))
      assert.ok(result.outputFiles[result.manifest['my_comp'].js].text.includes('comp-underscore'))
      assert.ok(result.outputFiles[result.manifest['my.comp'].js].text.includes('comp-dot'))
    })

    it('Testing Mode CSS Emission: emits virtual CSS imports when mode === "testing"', async () => {
      sm.registerComponent({
        id: 'styled-comp',
        styles: 'button { color: red; }',
        script: { content: '() => {}' }
      })

      const result = await sm.compileComponents('testing')

      assert.ok(result.manifest['styled-comp'], 'styled-comp should be in manifest')
      assert.ok(result.manifest['styled-comp'].css, 'CSS bundle should be present in manifest in testing mode')
    })

    it('Context Property Escaping: escapes context property keys with special characters or quotes safely', async () => {
      await sm.addContextProp('plugin "with" quotes\nand newlines', () => () => () => 'escaped')

      const result = await sm.compileComponents('production')
      const runtimeChunk = result.manifest['coralite-runtime']
      const compiledRuntime = result.outputFiles[runtimeChunk].text

      assert.ok(compiledRuntime.includes('plugin "with" quotes'), 'Escaped key should be in compiled runtime')
    })

    it('Physical Source File Mapping in Esbuild Error Reporting: Component Errors', async () => {
      const { resolve } = await import('node:path')
      const dummyComponentFile = resolve(process.cwd(), 'src/components/chat/atoll-chat-view.html')
      sm.registerComponent({
        id: 'atoll-chat-view',
        filePath: dummyComponentFile,
        script: {
          lineOffset: 5,
          content: 'async () => { const { getParsedAvatar } = await import("../../utils/nonexistent-avatar.js"); }'
        }
      })

      try {
        await sm.compileComponents('production')
        assert.fail('Compilation should have failed due to missing relative import')
      } catch (err) {
        assert.ok(err, 'An error should be thrown')
        assert.ok(!err.message.includes('coralite-virtual:'), `Error message must not contain any virtual namespace prefix: ${err.message}`)
        assert.ok(err.message.includes('atoll-chat-view.html'), `Error message should reference physical component file: ${err.message}`)

        assert.ok(Array.isArray(err.errors) && err.errors.length > 0, 'Error errors array must not be empty')
        const loc = err.errors[0].location
        assert.ok(loc.file.includes('atoll-chat-view.html'), `Location file should reference physical component: ${loc.file}`)
        assert.ok(loc.namespace === 'file' || loc.namespace === '', `Expected file namespace, got: ${loc.namespace}`)
      }
    })

    it('Physical Source File Mapping in Esbuild Error Reporting: Plugin Errors', async () => {
      const { resolve } = await import('node:path')
      const dummyPluginFile = resolve(process.cwd(), 'src/plugins/biometric-plugin.js')
      await sm.use({
        name: 'biometric-plugin',
        filePath: dummyPluginFile,
        rootDir: resolve(process.cwd(), 'src/plugins'),
        client: {
          context: () => async () => {
            const { adapter } = await import('./nonexistent-adapter.js')
          }
        }
      })

      try {
        await sm.compileComponents('production')
        assert.fail('Compilation should have failed due to missing relative import in plugin')
      } catch (err) {
        assert.ok(err, 'An error should be thrown')
        assert.ok(!err.message.includes('coralite-virtual:'), `Error message must not contain any virtual namespace prefix: ${err.message}`)
        assert.ok(err.message.includes('biometric-plugin.js'), `Error message should reference physical plugin file: ${err.message}`)

        assert.ok(Array.isArray(err.errors) && err.errors.length > 0, 'Error errors array must not be empty')
        const loc = err.errors[0].location
        assert.ok(loc.file.includes('biometric-plugin.js'), `Location file should reference physical plugin file: ${loc.file}`)
        assert.ok(loc.namespace === 'file' || loc.namespace === '', `Expected file namespace, got: ${loc.namespace}`)
      }
    })

    it('Plugin resolveDir Precedence: resolves relative imports against filePath directory rather than rootDir', async () => {
      const fs = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tmpDir = await fs.mkdtemp(join(tmpdir(), 'coralite-resolve-test-'))
      try {
        const rootDir = join(tmpDir, 'plugins')
        const subDir = join(rootDir, 'sub')
        await fs.mkdir(subDir, { recursive: true })
        await fs.writeFile(join(subDir, 'helper.js'), 'export const val = 42;')
        const pluginFile = join(subDir, 'plugin.js')

        await sm.use({
          name: 'resolve-dir-precedence-plugin',
          filePath: pluginFile,
          rootDir,
          client: {
            context: () => async () => {
              const { val } = await import('./helper.js')
              return { val }
            }
          }
        })

        sm.registerComponent({
          id: 'resolve-test-comp',
          script: { content: '() => {}' }
        })

        const res = await sm.compileComponents('production')
        assert.ok(res, 'Compilation should succeed when relative import resolves against filePath directory')
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('Async Helpers', () => {
    it('should support async phase1 initialization', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'test_plugin',
        context: async () => {
          // Simulate async phase1
          await Promise.resolve()
          return () => ({
            testHelper: () => 'sync_result'
          })
        }
      })

      sm.registerComponent({
        id: 'test',
        script: { content: '() => {}' }
      })

      const outputResult = await sm.compileComponents('development')
      const runtimeHashName = outputResult.manifest['coralite-runtime']
      const compiledScript = outputResult.outputFiles[runtimeHashName].text

      assert.ok(compiledScript.includes('getClientContext'))
      assert.ok(compiledScript.includes('globalContext'))
    })
  })

  describe('provideSource and consumeSource emission', () => {
    it('should compile provideSource and consumeSource into the component chunk', async () => {
      const sm = new ScriptManager()

      sm.registerComponent({
        id: 'provider',
        script: {
          content: '() => {}',
          provideSource: '() => ({ value: 42 })',
          consumeSource: '() => ({ fallback: true })'
        }
      })

      const result = await sm.compileComponents('development')
      const chunkHash = result.manifest['provider'].js || result.manifest['provider']
      const chunk = result.outputFiles[chunkHash].text

      assert.ok(chunk.includes('42'), 'provideSource should be compiled into the chunk')
      assert.ok(chunk.includes('fallback'), 'consumeSource should be compiled into the chunk')
    })

    it('should emit provide/consume placeholders when only content is supplied', async () => {
      const sm = new ScriptManager()

      sm.registerComponent({
        id: 'plain',
        script: { content: '() => {}' }
      })

      const result = await sm.compileComponents('development')
      const chunkHash = result.manifest['plain'].js || result.manifest['plain']
      const chunk = result.outputFiles[chunkHash].text

      assert.ok(chunk.includes('provide'))
      assert.ok(chunk.includes('consume'))
    })
  })
})
