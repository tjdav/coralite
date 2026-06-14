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

describe('ScriptManager Basics', () => {
  afterEach(async () => {
    for (const sm of activeManagers) {
      await sm.disposeContext()
    }
    activeManagers.length = 0
  })

  describe('Constructor', () => {
    it('should initialize with empty collections', () => {
      const sm = new ScriptManager()

      assert.strictEqual(Object.values(sm.sharedFunctions).length, 0)
      assert.strictEqual(Object.keys(sm.contextProps).length, 0)
      assert.strictEqual(sm.plugins.length, 0)
    })
  })

  describe('use() - Plugin Registration', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should register plugin with context', async () => {
      const context = () => {
        return {
          helper1: () => 'helper1',
          helper2: (x) => x * 2
        }
      }

      const plugin = {
        name: 'test',
        context
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules.length, 1)
      assert.strictEqual(sm.scriptModules[0].context, context)
      assert.strictEqual(sm.plugins.length, 1)
    })

    it('should register function plugin', async () => {
      const pluginFn = () => {
      }

      await sm.use(pluginFn)

      assert.strictEqual(sm.plugins.length, 1)
      assert.strictEqual(sm.plugins[0], pluginFn)
    })

    it('should handle plugin with no setup property', async () => {
      const context = () => ({ test: () => 'test' })
      const plugin = {
        name: 'test',
        context
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].context, context)
    })

    it('should register plugin context', async () => {
      const context = () => ({ own: () => 'own' })

      const plugin = {
        name: 'test',
        context
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].context, context)
    })

    it('should return this for method chaining', async () => {
      const result = await sm.use({
        context: () => {
        }
      })
      assert.strictEqual(result, sm)
    })

    it('should handle context with async methods', async () => {
      const context = () => ({ asyncHelper: async () => 'async' })
      const plugin = {
        name: 'test',
        context
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].context, context)
    })
  })

  describe('addContextProp() - Helper Registration', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should add helper function', async () => {
      const helper = (x) => x + 1
      await sm.addContextProp('increment', helper)

      assert.ok(sm.contextProps.increment)
      assert.strictEqual(sm.contextProps.increment, '(x) => x + 1')
    })

    it('should add async helper function', async () => {
      const asyncHelper = async (x) => x * 2
      await sm.addContextProp('double', asyncHelper)

      assert.ok(sm.contextProps.double)
      assert.strictEqual(sm.contextProps.double, 'async (x) => x * 2')
    })

    it('should add method shorthand helper', async () => {
      const obj = {
        method: function () {
          return 'test'
        }
      }
      await sm.addContextProp('methodHelper', obj.method)

      assert.ok(sm.contextProps.methodHelper)
      assert.match(sm.contextProps.methodHelper, /function/)
    })

    it('should overwrite existing helper with same name', async () => {
      await sm.addContextProp('test', () => 'first')
      assert.strictEqual(sm.contextProps.test, '() => \'first\'')

      await sm.addContextProp('test', () => 'second')
      assert.strictEqual(sm.contextProps.test, '() => \'second\'')
    })

    it('should return this for method chaining', async () => {
      const result = await sm.addContextProp('test', () => 'test')
      assert.strictEqual(result, sm)
    })

    it('should handle complex function types', async () => {
      const arrowWithBlock = (x) => {
        const y = x * 2
        return y + 1
      }
      await sm.addContextProp('complex', arrowWithBlock)

      assert.ok(sm.contextProps.complex.includes('const y = x * 2'))
    })

    it('should handle function with default parameters', async () => {
      const fn = (a = 1, b = 2) => a + b
      await sm.addContextProp('defaults', fn)

      assert.ok(sm.contextProps.defaults.includes('a = 1'))
      assert.ok(sm.contextProps.defaults.includes('b = 2'))
    })

    it('should handle getter/setter methods', async () => {
      const obj = {
        get value () {
          return this._value
        },
        set value (v) {
          this._value = v
        }
      }

      const getterDescriptor = Object.getOwnPropertyDescriptor(obj, 'value')
      const setterDescriptor = Object.getOwnPropertyDescriptor(obj, 'value')

      await sm.addContextProp('getter', getterDescriptor.get)
      await sm.addContextProp('setter', setterDescriptor.set)

      assert.ok(sm.contextProps.getter.includes('get value'))
      assert.ok(sm.contextProps.setter.includes('set value'))
    })
  })

  describe('registerComponent() - Component Registration', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should register component with function script string', async () => {
      const script = { content: '(context) => context.values' }
      sm.registerComponent({
        id: 'test-component',
        script
      })

      assert.ok(sm.sharedFunctions['test-component'])
      const registered = sm.sharedFunctions['test-component']
      assert.strictEqual(registered.id, 'test-component')
      assert.strictEqual(registered.script, script)
    })

    it('should register component with string script', async () => {
      const script = { content: 'console.log("test")' }
      sm.registerComponent({
        id: 'string-component',
        script
      })

      assert.ok(sm.sharedFunctions['string-component'])
      const registered = sm.sharedFunctions['string-component']
      assert.strictEqual(registered.script, script)
    })

    it('should overwrite existing component', async () => {
      const script1 = { content: "() => 'first'" }
      const script2 = { content: "() => 'second'" }

      sm.registerComponent({
        id: 'test',
        script: script1,
        override: true
      })
      assert.strictEqual(sm.sharedFunctions['test'].script, script1)

      sm.registerComponent({
        id: 'test',
        script: script2,
        override: true
      })
      assert.strictEqual(sm.sharedFunctions['test'].script, script2)
    })

    it('should handle async registration', async () => {
      const script = { content: "async () => 'async'" }
      sm.registerComponent({
        id: 'async-component',
        script
      })

      assert.ok(sm.sharedFunctions['async-component'])
    })

    it('should handle component with complex script', async () => {
      const script = {
        content: `function (context) {
          const result = context.values.map(x => x * 2)
          return result
        }`
      }

      sm.registerComponent({
        id: 'complex',
        script
      })

      const registered = sm.sharedFunctions['complex']
      assert.strictEqual(registered.script, script)
    })
  })

  describe('ScriptManager Config Injection', () => {
    it('should inject config into helper context', async () => {
      const manager = new ScriptManager()
      const config = {
        baseURL: 'http://example.com',
        apiKey: '123'
      }

      await manager.use({
        name: 'test_plugin',
        config,
        context: (pluginContext) => {
          return {
            testHelper: () => pluginContext.config
          }
        }
      })

      assert.strictEqual(manager.plugins.length, 1)
    })
  })
})
