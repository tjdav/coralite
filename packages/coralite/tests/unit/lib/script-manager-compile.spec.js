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

  describe('compileAllInstances() - Full Compilation', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should compile single instance', async () => {
      sm.registerComponent({
        id: 'test',
        script: {
          content: `({ double, values }) => {
            return context.values.count * 2
          }`
        }
      })

      const instances = {
        'inst-1': {
          componentId: 'test',
          instanceId: 'inst-1',
          state: { count: 5 },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['test'])
    })

    it('should handle empty instances object', async () => {
      const result = await sm.compileAllInstances({}, 'production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['coralite-runtime'])
    })

    it('should handle instances without shared functions', async () => {
      const instances = {
        'inst-1': {
          componentId: 'nonexistent',
          instanceId: 'inst-1',
          state: {},
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
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

      const instances = {
        'inst-1': {
          componentId: 'async',
          instanceId: 'inst-1',
          state: { x: 42 },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
      const chunkHashName = result.manifest['async']
      assert.ok(result.outputFiles[chunkHashName].text.includes('async'))
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

      const instances = {
        'inst-1': {
          componentId: 'complex',
          instanceId: 'inst-1',
          state: {
            message: 'Hello World',
            ref_element: 'div'
          },
          component: { title: 'Test' }
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['complex'])
    })

    it('should produce valid JavaScript', async () => {
      sm.registerComponent({
        id: 'test',
        script: { content: '(context) => context.values.x' }
      })

      const instances = {
        'inst-1': {
          componentId: 'test',
          instanceId: 'inst-1',
          state: { x: 1 },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      // Should be compiled properly
      assert.ok(result.manifest['test'])
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
          return {
            testHelper: () => 'sync_result'
          }
        }
      })

      sm.registerComponent({
        id: 'test',
        script: { content: '() => {}' }
      })

      const instances = {
        'inst-1': {
          instanceId: '1',
          componentId: 'test',
          state: {},
          component: {}
        }
      }

      const outputResult = await sm.compileAllInstances(instances, 'development')
      const runtimeHashName = outputResult.manifest['coralite-runtime']
      const compiledScript = outputResult.outputFiles[runtimeHashName].text

      assert.ok(compiledScript.includes('getClientContext'))
      assert.ok(compiledScript.includes('globalContext'))
    })
  })
})
