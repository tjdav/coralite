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
})
