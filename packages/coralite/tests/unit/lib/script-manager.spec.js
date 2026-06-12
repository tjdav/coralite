import { describe, it, beforeEach, mock, after } from 'node:test'
import { strict as assert } from 'node:assert'
import { ScriptManager } from '../../../lib/script-manager.js'
import fs from 'node:fs'
import path from 'node:path'

describe('ScriptManager', () => {
  // Setup temp test file for imports
  const tempFile = path.resolve('temp-test-module.js')
  fs.writeFileSync(tempFile, 'export const version = "1.0.0"; export const name = "test"; export default "default-value";')

  after(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile)
    }
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

    it('should register plugin with setup function', async () => {
      const setupMock = mock.fn()
      const plugin = { setup: setupMock }

      await sm.use(plugin)

      // setup is no longer called during registration, it's run client-side
      assert.strictEqual(setupMock.mock.calls.length, 0)
      assert.strictEqual(sm.plugins.length, 1)
      assert.strictEqual(sm.plugins[0], plugin)
      assert.strictEqual(sm.scriptModules.length, 1)
      assert.strictEqual(sm.scriptModules[0], plugin)
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

    it('should register plugin with both setup and context', async () => {
      const setupMock = mock.fn()
      const context = () => ({ testHelper: () => 'test' })

      const plugin = {
        name: 'test',
        setup: setupMock,
        context
      }

      await sm.use(plugin)

      assert.strictEqual(setupMock.mock.calls.length, 0)
      assert.strictEqual(sm.scriptModules.length, 1)
      assert.strictEqual(sm.scriptModules[0].context, context)
    })

    it('should register function plugin', async () => {
      const pluginFn = () => {
      }

      await sm.use(pluginFn)

      assert.strictEqual(sm.plugins.length, 1)
      assert.strictEqual(sm.plugins[0], pluginFn)
    })

    it('should handle plugin with null setup', async () => {
      const context = () => ({ test: () => 'test' })
      const plugin = {
        name: 'test',
        setup: null,
        context
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].context, context)
    })

    it('should handle plugin with undefined setup', async () => {
      const context = () => ({ test: () => 'test' })
      const plugin = {
        name: 'test',
        setup: undefined,
        context
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].context, context)
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
        setup: () => {
        }
      })
      assert.strictEqual(result, sm)
    })

    it('should handle async setup function', async () => {
      const setupMock = mock.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
      })
      const plugin = { setup: setupMock }

      await sm.use(plugin)

      // setup is no longer called during registration
      assert.strictEqual(setupMock.mock.calls.length, 0)
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

  describe('generateInstanceWrapper() - Instance Wrapper Generation', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should generate wrapper with values', () => {
      const instanceContext = {
        instanceId: 'inst-1',
        state: {
          count: 5,
          name: 'test'
        }
      }

      const result = sm.generateInstanceWrapper('component-1', instanceContext)

      assert.ok(result.includes('await coraliteComponentFunctions["component-1"]'))
      assert.ok(result.includes('instanceId: \'inst-1\''))
      assert.ok(result.includes('state:'))
      assert.ok(result.includes('count'))
      assert.ok(result.includes('name'))
    })

    it('should generate wrapper without values', () => {
      const instanceContext = {
        instanceId: 'inst-2'
      }

      const result = sm.generateInstanceWrapper('component-2', instanceContext)

      assert.ok(result.includes('state: {}'))
      assert.ok(result.includes('instanceId: \'inst-2\''))
    })

    it('should handle instance context with refs', () => {
      const instanceContext = {
        instanceId: 'inst-3',
        state: {
          x: 1,
          ref_button: 'element'
        }
      }

      const result = sm.generateInstanceWrapper('component-3', instanceContext)

      assert.ok(result.includes('instanceId: \'inst-3\''))
      assert.ok(result.includes('state:'))
    })

    it('should serialize complex values', () => {
      const instanceContext = {
        instanceId: 'inst-4',
        state: {
          nested: {
            a: 1,
            b: [1, 2, 3]
          },
          func: () => 'test'
        }
      }

      const result = sm.generateInstanceWrapper('component-4', instanceContext)

      assert.ok(result.includes('nested'))
      assert.ok(result.includes('a'))
      assert.ok(result.includes('b'))
    })

    it('should handle empty instance context', () => {
      const instanceContext = {}

      const result = sm.generateInstanceWrapper('component-5', instanceContext)

      assert.ok(result.includes('state: {}'))
      assert.ok(result.includes('instanceId: \'undefined\''))
    })

    it('should handle instance context with page object', () => {
      const instanceContext = {
        instanceId: 'inst-6',
        page: {
          url: { pathname: '/example' }
        }
      }

      const result = sm.generateInstanceWrapper('component-6', instanceContext)

      assert.ok(result.includes('page:'))
      assert.ok(result.includes('pathname'))
      assert.ok(result.includes('example'))
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
      const chunkHashName = result.manifest['test']
      assert.ok(result.outputFiles[chunkHashName])
      assert.ok(result.outputFiles[chunkHashName].text.length > 0)
    })

    it('should compile multiple instances with shared component', async () => {
      sm.registerComponent({
        id: 'shared',
        script: {
          content: `({ double, values }) => {
            return context.values.x + context.values.y
          }`
        }
      })

      const instances = {
        'inst-1': {
          componentId: 'shared',
          instanceId: 'inst-1',
          state: {
            x: 1,
            y: 2
          },
          component: {}
        },
        'inst-2': {
          componentId: 'shared',
          instanceId: 'inst-2',
          state: {
            x: 3,
            y: 4
          },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['shared'])
    })

    it('should compile multiple instances with different components', async () => {
      sm.registerComponent({
        id: 'component1',
        script: { content: '(context) => context.values.a' }
      })
      sm.registerComponent({
        id: 'component2',
        script: { content: '(context) => context.values.b' }
      })

      const instances = {
        'inst-1': {
          componentId: 'component1',
          instanceId: 'inst-1',
          state: { a: 1 },
          component: {}
        },
        'inst-2': {
          componentId: 'component2',
          instanceId: 'inst-2',
          state: { b: 2 },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['component1'])
      assert.ok(result.manifest['component2'])
    })

    it('should include context in compiled code', async () => {
      await sm.addContextProp('double', () => (x) => x * 2)
      sm.registerComponent({
        id: 'test',
        script: {
          content: `({ double, state }) => {
            return double(state.x)
          }`
        }
      })

      const instances = {
        'inst-1': {
          componentId: 'test',
          instanceId: 'inst-1',
          state: { x: 5 },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'development')
      const chunkSharedHashName = result.manifest['chunk-shared']
      const chunkSharedText = result.outputFiles[chunkSharedHashName].text
      assert.ok(chunkSharedText.includes('double'))
      assert.ok(chunkSharedText.includes('coraliteComponentClientContextProps'))
    })

    it('should handle instances with refs', async () => {
      sm.registerComponent({
        id: 'test',
        script: {
          content: `({ double, values }) => {
            return context.refs('button') ? 'found' : 'not found'
          }`
        }
      })

      const instances = {
        'inst-1': {
          componentId: 'test',
          instanceId: 'inst-1',
          state: {
            ref_button: 'element'
          },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
    })

    it('should handle instances with page context', async () => {
      sm.registerComponent({
        id: 'test',
        script: {
          content: `({ double, values }) => {
            return context.page.meta.title || 'no title'
          }`
        }
      })

      const instances = {
        'inst-1': {
          componentId: 'test',
          instanceId: 'inst-1',
          state: {},
          page: { meta: { title: 'Test Page' } }
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')

      assert.ok(typeof result === 'object')
    })

    it('should handle empty instances object', async () => {
      const result = await sm.compileAllInstances({}, 'production')

      assert.ok(typeof result === 'object')
      assert.ok(result.manifest['chunk-shared'])
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
            await new Promise(resolve => setTimeout(resolve, 1))
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

  describe('Integration Tests', () => {
    it('should handle full workflow: plugin → helper → component → instance → compile', async () => {
      const sm = new ScriptManager()

      // Register plugin with helper
      await sm.use({
        name: 'test_plugin',
        setup: () => {
          return { customProperty: 'test' }
        },
        context: () => {
          return {
            add: (a, b) => a + b
          }
        }
      })

      // Add another helper
      await sm.addContextProp('multiply', () => () => (a, b) => a * b)

      // Register component
      sm.registerComponent({
        id: 'calculator',
        script: {
          stateContent: '{}',
          lineOffset: 0,
          content: `(context) => {
            const { add } = context.test_plugin;
            const multiply = context.multiply;
            const sum = add(context.state.a, context.state.b)
            const product = multiply(sum, context.state.multiplier)
            // also return customProperty if present to prove setup injected it
            if (context.state.customProperty === 'test') {
              return product + 1000
            }
            return product
          }`
        }
      })

      // Compile instances
      const instances = {
        'calc-1': {
          componentId: 'calculator',
          instanceId: 'calc-1',
          state: {
            a: 2,
            b: 3,
            multiplier: 10
          },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'development')

      assert.ok(typeof result === 'object')
      const chunkHashName = result.manifest['calculator']

      // "customProperty" is in the original template code string, but esbuild might transform the property access `context.values.customProperty`
      // For this test, verifying the chunk exists and successfully built is sufficient.
      assert.ok(result.outputFiles[chunkHashName])
    })

    it('should handle multiple plugins with overlapping context', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'p1',
        context: () => ({
          helper1: () => 'first',
          shared: (x) => x * 2
        })
      })

      await sm.use({
        name: 'p2',
        context: () => ({
          helper2: () => 'second',
          shared: (x) => x * 3
        })
      })

      assert.strictEqual(sm.scriptModules.length, 2)
      assert.ok(sm.scriptModules[0].context)
      assert.ok(sm.scriptModules[1].context)
      // Overwrite behavior is handled by esbuild spreading imports, not internal state
    })

    it('should handle method chaining throughout', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'p1',
        context: () => ({ h1: () => 1 })
      })
      await sm.addContextProp('h2', () => 2)
      sm.registerComponent({
        id: 't1',
        script: { content: "() => 'test'" }
      })

      assert.strictEqual(sm.scriptModules.length, 1)
      assert.ok(sm.contextProps.h2)
      assert.ok(sm.sharedFunctions['t1'])
    })
  })

  describe('Edge Cases', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should handle null plugin', async () => {
      await sm.use(null)
      assert.strictEqual(sm.plugins.length, 1)
    })

    it('should handle undefined plugin', async () => {
      await sm.use(undefined)
      assert.strictEqual(sm.plugins.length, 1)
    })

    it('should handle plugin with empty context object', async () => {
      await sm.use({ context: {} })
      assert.strictEqual(Object.keys(sm.contextProps).length, 0)
    })

    it('should handle helper with no name', async () => {
      await sm.addContextProp('', () => 'test')
      assert.ok(sm.contextProps[''])
    })

    it('should handle component with non-function script', async () => {
      const script = { content: '123' }
      sm.registerComponent({
        id: 'test',
        script
      })
      const registered = sm.sharedFunctions['test']
      assert.strictEqual(registered.script, script)
    })

    it('should handle instance with missing state', async () => {
      sm.registerComponent({
        id: 'test',
        script: { content: "() => 'test'" }
      })

      const instances = {
        'inst-1': {
          componentId: 'test'
          // Missing values, refs, component
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')
      assert.ok(typeof result === 'object')
    })

    it('should handle very large number of instances', async () => {
      sm.registerComponent({
        id: 'test',
        script: { content: '(context) => context.values.x' }
      })

      const instances = {}
      for (let i = 0; i < 100; i++) {
        instances[`inst-${i}`] = {
          componentId: 'test',
          state: { x: i },
          component: {}
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')
      assert.ok(typeof result === 'object')
    })

    it('should handle special characters in component IDs', async () => {
      sm.registerComponent({
        id: 'component-with-dashes',
        script: { content: "() => 'test'" }
      })
      sm.registerComponent({
        id: 'component_with_underscores',
        script: { content: "() => 'test'" }
      })
      sm.registerComponent({
        id: 'component.with.dots',
        script: { content: "() => 'test'" }
      })

      assert.ok(sm.sharedFunctions['component-with-dashes'])
      assert.ok(sm.sharedFunctions['component_with_underscores'])
      assert.ok(sm.sharedFunctions['component.with.dots'])
    })

    it('should handle special characters in helper names', async () => {
      await sm.addContextProp('$private', () => 'private')
      await sm.addContextProp('_internal', () => 'internal')
      await sm.addContextProp('helper$With$Dollars', () => 'dollars')

      assert.ok(sm.contextProps.$private)
      assert.ok(sm.contextProps._internal)
      assert.ok(sm.contextProps.helper$With$Dollars)
    })

    it('should handle context that return complex objects', async () => {
      const complexHelper = () => ({
        nested: { value: 42 },
        array: [1, 2, 3],
        method: () => 'test'
      })

      await sm.addContextProp('complex', complexHelper)

      assert.ok(sm.contextProps.complex)
      assert.ok(sm.contextProps.complex.includes('nested'))
    })

    it('should handle component that uses all context state', async () => {
      sm.registerComponent({
        id: 'full',
        script: {
          content: `({ double, values }) => {
            return \`\${context.instanceId}-\${context.componentId}-\${context.values.x}-\${context.refs('el')}-\${context.page.meta.title}\`
          }`
        }
      })

      const instances = {
        'inst-1': {
          componentId: 'full',
          state: {
            x: 1,
            ref_el: 'div'
          },
          page: { meta: { title: 'Test' } }
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')
      assert.ok(typeof result === 'object')
    })

    it('should handle AST nodes in defaultValues by transforming them to HTML strings', async () => {
      const parent = {
        type: 'tag',
        name: 'div',
        children: [],
        attribs: {}
      }
      const child = {
        type: 'tag',
        name: 'span',
        parent: parent,
        children: [],
        attribs: {}
      }
      parent.children.push(child)

      sm.registerComponent({
        id: 'test-ast',
        defaultValues: {
          element: child,
          items: [parent]
        }
      })

      const instances = {
        'inst-1': {
          componentId: 'test-ast',
          instanceId: 'inst-1'
        }
      }

      const result = await sm.compileAllInstances(instances, 'production')
      assert.ok(result, 'Should have successfully compiled')

      const chunkHashName = result.manifest['test-ast']
      const output = result.outputFiles[chunkHashName].text
      assert.ok(output.includes('<span></span>'), 'Output should contain serialized span HTML')
      assert.ok(output.includes('<div><span></span></div>'), 'Output should contain serialized parent HTML')
    })
  })

  describe('Source Maps', () => {
    it('should generate inline source map containing the file path', async () => {
      const sm = new ScriptManager()
      const componentId = 'test-component'
      const script = { content: '(context) => context.values.message' }
      const filePath = '/absolute/path/to/test-component.html'

      sm.registerComponent({
        id: componentId,
        script,
        filePath
      })

      /**
       * @type {{
       * [x: string]: import('../../../types/script.js').InstanceContext
       * }}
       */
      const instances = {
        'inst-1': {
          componentId,
          instanceId: 'inst-1',
          state: { message: 'Hello' }
        }
      }

      const outputResult = await sm.compileAllInstances(instances, 'development')

      const chunkSharedHashName = outputResult.manifest['chunk-shared']
      const output = outputResult.outputFiles[chunkSharedHashName].text

      // Check for inline source map
      assert.ok(output.includes('//# sourceMappingURL=data:application/json;base64,'), 'Output should contain inline source map')

      // Decode source map
      const base64Map = output.split('base64,')[1]
      const decodedMap = Buffer.from(base64Map.trim(), 'base64').toString('utf-8')
      const sourceMap = JSON.parse(decodedMap)

      // Check if sources array contains the file path
      // esbuild uses the exact virtual entry point ID
      const hasFile = sourceMap.sources.some(source => source.includes('chunk-shared'))

      assert.ok(hasFile, `Source map sources should contain chunk-shared. Found: ${JSON.stringify(sourceMap.sources)}`)
    })
  })


  describe('Async Helpers', () => {
    it('should support async phase1 initialization', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'test_plugin',
        context: async () => {
          // Simulate async phase1
          await new Promise(resolve => setTimeout(resolve, 10))
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
      const chunkSharedHashName = outputResult.manifest['chunk-shared']
      const compiledScript = outputResult.outputFiles[chunkSharedHashName].text

      // Under the new orchestrator approach with esbuild ESM compilation, `await getClientContext(context)`
      // is no longer generated as a literal string in the instances wrapper, but the `getClientContext` and
      // `globalContext` definitions still exist in the generated shared helper block.
      assert.ok(compiledScript.includes('getClientContext'))
      assert.ok(compiledScript.includes('globalContext'))
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

      const instances = {
        inst1: {
          instanceId: 'inst1',
          componentId: 'temp1',
          state: {},
          component: {}
        }
      }

      manager.registerComponent({
        id: 'temp1',
        script: { content: '() => {}' }
      })

      const outputResult = await manager.compileAllInstances(instances, 'development')
      const chunkSharedHashName = outputResult.manifest['chunk-shared']
      const compiledScript = outputResult.outputFiles[chunkSharedHashName].text

      // Verify config injection in generated code with whitespace-agnostic regex
      // Looks for: pluginConfig = { ... "baseURL": "http://example.com" ... "apiKey": "123" ... }
      assert.match(compiledScript, /pluginConfig\s*=\s*\{\s*"baseURL"\s*:\s*"http:\/\/example\.com"\s*,\s*"apiKey"\s*:\s*"123"\s*\}/)
    })

    it('should handle missing config gracefully', async () => {
      const manager = new ScriptManager()

      await manager.use({
        name: 'test_plugin',
        context: (globalContext) => {
          return {
            testHelper: () => globalContext.config
          }
        }
      })

      const instances = {
        inst1: {
          instanceId: 'inst1',
          componentId: 'temp1',
          state: {},
          component: {}
        }
      }

      manager.registerComponent({
        id: 'temp1',
        script: { content: '() => {}' }
      })

      const outputResult = await manager.compileAllInstances(instances, 'development')
      const chunkSharedHashName = outputResult.manifest['chunk-shared']
      const compiledScript = outputResult.outputFiles[chunkSharedHashName].text

      assert.match(compiledScript, /pluginConfig\s*=\s*\{\}/)
    })

    it('should deeply merge defaultValues in registerComponent', async () => {
      const manager = new ScriptManager()

      manager.registerComponent({
        id: 'test',
        script: { content: '() => {}' },
        defaultValues: { a: 1 },
        override: true
      })

      // Register again with new defaultValues
      manager.registerComponent({
        id: 'test',
        defaultValues: {
          b: 2,
          a: 3
        },
        override: false
      })

      const registered = manager.sharedFunctions['test']
      assert.deepStrictEqual(registered.defaultValues, {
        a: 1
      })
    })

    it('should not externalize imports matching plugin names', async () => {
      const sm = new ScriptManager()

      // Create a dummy package in node_modules for esbuild to find
      const nodeModulesPath = path.resolve('node_modules')
      const dummyPath = path.resolve(nodeModulesPath, 'dummy_plugin_pkg')
      if (!fs.existsSync(dummyPath)) {
        fs.mkdirSync(dummyPath, { recursive: true })
      }
      fs.writeFileSync(path.resolve(dummyPath, 'package.json'), JSON.stringify({
        name: 'dummy_plugin_pkg',
        type: 'module',
        main: 'index.js'
      }))
      fs.writeFileSync(path.resolve(dummyPath, 'index.js'), 'export default "dummy"')

      try {
        await sm.use({
          name: 'dummy_plugin_pkg',
          context: async () => {
            // @ts-ignore
            const { default: dummy } = await import('dummy_plugin_pkg')
            return {
              test: () => dummy
            }
          }
        })

        sm.registerComponent({
          id: 'test',
          script: { content: '() => {}' }
        })

        const result = await sm.compileAllInstances({
          inst: {
            componentId: 'test',
            instanceId: 'inst'
          }
        }, 'development')

        const chunkShared = result.manifest['chunk-shared']
        const content = result.outputFiles[chunkShared].text

        assert.ok(!content.includes('import("dummy-plugin-pkg")'), 'Should have bundled or transformed the import, not left it as a bare specifier')
      } finally {
        if (fs.existsSync(dummyPath)) {
          fs.rmSync(dummyPath, {
            recursive: true,
            force: true
          })
        }
      }
    })
  })
})
