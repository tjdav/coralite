import { describe, it, beforeEach, mock } from 'node:test'
import { strict as assert } from 'node:assert'
import { ScriptManager } from '#lib'

describe('ScriptManager', () => {
  describe('Constructor', () => {
    it('should initialize with empty collections', () => {
      const sm = new ScriptManager()

      assert.ok(sm.sharedFunctions instanceof Map)
      assert.strictEqual(sm.sharedFunctions.size, 0)

      assert.ok(sm.helpers instanceof Object)
      assert.strictEqual(Object.keys(sm.helpers).length, 0)

      assert.ok(sm.factoryHelpers instanceof Set)
      assert.strictEqual(sm.factoryHelpers.size, 0)

      assert.ok(sm.plugins instanceof Array)
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

      assert.strictEqual(setupMock.mock.calls.length, 1)
      assert.strictEqual(setupMock.mock.calls[0].arguments[0], sm)
      assert.strictEqual(sm.plugins.length, 1)
      assert.strictEqual(sm.plugins[0], plugin)
    })

    it('should register plugin with helpers', async () => {
      const helper1 = () => 'helper1'
      const helper2 = (x) => x * 2

      const plugin = {
        helpers: {
          helper1,
          helper2
        }
      }

      await sm.use(plugin)

      assert.strictEqual(Object.keys(sm.helpers).length, 2)
      assert.ok(sm.helpers.helper1)
      assert.ok(sm.helpers.helper2)
      assert.strictEqual(sm.plugins.length, 1)
    })

    it('should register plugin with both setup and helpers', async () => {
      const setupMock = mock.fn()
      const helper = () => 'test'

      const plugin = {
        setup: setupMock,
        helpers: { testHelper: helper }
      }

      await sm.use(plugin)

      assert.strictEqual(setupMock.mock.calls.length, 1)
      assert.strictEqual(Object.keys(sm.helpers).length, 1)
      assert.ok(sm.helpers.testHelper)
    })

    it('should register function plugin', async () => {
      const pluginFn = () => {
      }

      await sm.use(pluginFn)

      assert.strictEqual(sm.plugins.length, 1)
      assert.strictEqual(sm.plugins[0], pluginFn)
    })

    it('should handle plugin with null setup', async () => {
      const plugin = {
        setup: null,
        helpers: { test: () => 'test' }
      }

      await sm.use(plugin)

      assert.strictEqual(sm.helpers.test, '() => \'test\'')
    })

    it('should handle plugin with undefined setup', async () => {
      const plugin = {
        setup: undefined,
        helpers: { test: () => 'test' }
      }

      await sm.use(plugin)

      assert.strictEqual(sm.helpers.test, '() => \'test\'')
    })

    it('should handle plugin with no setup property', async () => {
      const plugin = { helpers: { test: () => 'test' } }

      await sm.use(plugin)

      assert.strictEqual(sm.helpers.test, '() => \'test\'')
    })

    it('should skip helpers that are not own properties', async () => {
      const protoHelpers = { inherited: () => 'inherited' }
      const helpers = Object.create(protoHelpers)
      helpers.own = () => 'own'

      const plugin = { helpers }

      await sm.use(plugin)

      assert.ok(sm.helpers.own)
      assert.strictEqual(sm.helpers.inherited, undefined)
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

      assert.strictEqual(setupMock.mock.calls.length, 1)
    })

    it('should handle helpers with async methods', async () => {
      const asyncHelper = async () => 'async'
      const plugin = { helpers: { asyncHelper } }

      await sm.use(plugin)

      assert.ok(sm.helpers.asyncHelper)
    })
  })

  describe('addHelper() - Helper Registration', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should add helper function', async () => {
      const helper = (x) => x + 1
      await sm.addHelper('increment', helper)

      assert.ok(sm.helpers.increment)
      assert.strictEqual(sm.helpers.increment, '(x) => x + 1')
    })

    it('should add async helper function', async () => {
      const asyncHelper = async (x) => x * 2
      await sm.addHelper('double', asyncHelper)

      assert.ok(sm.helpers.double)
      assert.strictEqual(sm.helpers.double, 'async (x) => x * 2')
    })

    it('should add method shorthand helper', async () => {
      const obj = {
        method: function () {
          return 'test'
        }
      }
      await sm.addHelper('methodHelper', obj.method)

      assert.ok(sm.helpers.methodHelper)
      assert.match(sm.helpers.methodHelper, /function/)
    })

    it('should overwrite existing helper with same name', async () => {
      await sm.addHelper('test', () => 'first')
      assert.strictEqual(sm.helpers.test, '() => \'first\'')

      await sm.addHelper('test', () => 'second')
      assert.strictEqual(sm.helpers.test, '() => \'second\'')
    })

    it('should return this for method chaining', async () => {
      const result = await sm.addHelper('test', () => 'test')
      assert.strictEqual(result, sm)
    })

    it('should handle complex function types', async () => {
      const arrowWithBlock = (x) => {
        const y = x * 2
        return y + 1
      }
      await sm.addHelper('complex', arrowWithBlock)

      assert.ok(sm.helpers.complex.includes('const y = x * 2'))
    })

    it('should handle function with default parameters', async () => {
      const fn = (a = 1, b = 2) => a + b
      await sm.addHelper('defaults', fn)

      assert.ok(sm.helpers.defaults.includes('a = 1'))
      assert.ok(sm.helpers.defaults.includes('b = 2'))
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

      await sm.addHelper('getter', getterDescriptor.get)
      await sm.addHelper('setter', setterDescriptor.set)

      assert.ok(sm.helpers.getter.includes('get value'))
      assert.ok(sm.helpers.setter.includes('set value'))
    })
  })

  describe('getHelpers() - Helper Retrieval', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should return empty object string when no helpers', () => {
      const result = sm.getHelpers()
      assert.strictEqual(result, '{}')
    })

    it('should return formatted helpers string', async () => {
      await sm.addHelper('helper1', () => 'test1')
      await sm.addHelper('helper2', (x) => x * 2)

      const result = sm.getHelpers()

      assert.ok(result.includes('"helper1": () => \'test1\''))
      assert.ok(result.includes('"helper2": (x) => x * 2'))
    })

    it('should handle multiple helpers', async () => {
      await sm.addHelper('a', () => 1)
      await sm.addHelper('b', () => 2)
      await sm.addHelper('c', () => 3)

      const result = sm.getHelpers()

      assert.ok(result.includes('"a":'))
      assert.ok(result.includes('"b":'))
      assert.ok(result.includes('"c":'))
    })

    it('should handle helpers with special characters in names', async () => {
      await sm.addHelper('$private', () => 'private')
      await sm.addHelper('_internal', () => 'internal')

      const result = sm.getHelpers()

      assert.ok(result.includes('"$private":'))
      assert.ok(result.includes('"_internal":'))
    })

    it('should ignore context parameter (for compatibility)', async () => {
      await sm.addHelper('test', () => 'value')

      const result1 = sm.getHelpers()
      const result2 = sm.getHelpers({ instanceId: 'test' })

      assert.strictEqual(result1, result2)
    })
  })

  describe('registerTemplate() - Template Registration', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should register template with function script', async () => {
      const script = (context) => context.values
      await sm.registerTemplate('test-template', script)

      assert.ok(sm.sharedFunctions.has('test-template'))
      const registered = sm.sharedFunctions.get('test-template')
      assert.strictEqual(registered.templateId, 'test-template')
      assert.strictEqual(registered.script, script)
    })

    it('should register template with string script', async () => {
      const script = 'console.log("test")'
      await sm.registerTemplate('string-template', script)

      assert.ok(sm.sharedFunctions.has('string-template'))
      const registered = sm.sharedFunctions.get('string-template')
      assert.strictEqual(registered.script, script)
    })

    it('should overwrite existing template', async () => {
      const script1 = () => 'first'
      const script2 = () => 'second'

      await sm.registerTemplate('test', script1)
      assert.strictEqual(sm.sharedFunctions.get('test').script, script1)

      await sm.registerTemplate('test', script2)
      assert.strictEqual(sm.sharedFunctions.get('test').script, script2)
    })

    it('should handle async registration', async () => {
      const script = async () => 'async'
      await sm.registerTemplate('async-template', script)

      assert.ok(sm.sharedFunctions.has('async-template'))
    })

    it('should handle template with complex script', async () => {
      const script = function (context) {
        const result = context.values.map(x => x * 2)
        return result
      }

      await sm.registerTemplate('complex', script)

      const registered = sm.sharedFunctions.get('complex')
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
        values: {
          count: 5,
          name: 'test'
        }
      }

      const result = sm.generateInstanceWrapper('template-1', instanceContext)

      assert.ok(result.includes('await coraliteTemplateFunctions["template-1"]'))
      assert.ok(result.includes('instanceId: \'inst-1\''))
      assert.ok(result.includes('values:'))
      assert.ok(result.includes('count'))
      assert.ok(result.includes('name'))
    })

    it('should generate wrapper without values', () => {
      const instanceContext = {
        instanceId: 'inst-2'
      }

      const result = sm.generateInstanceWrapper('template-2', instanceContext)

      assert.ok(result.includes('values: {}'))
      assert.ok(result.includes('instanceId: \'inst-2\''))
    })

    it('should handle instance context with refs', () => {
      const instanceContext = {
        instanceId: 'inst-3',
        values: { x: 1 },
        refs: { button: 'element' }
      }

      const result = sm.generateInstanceWrapper('template-3', instanceContext)

      assert.ok(result.includes('instanceId: \'inst-3\''))
      assert.ok(result.includes('values:'))
    })

    it('should serialize complex values', () => {
      const instanceContext = {
        instanceId: 'inst-4',
        values: {
          nested: {
            a: 1,
            b: [1, 2, 3]
          },
          func: () => 'test'
        }
      }

      const result = sm.generateInstanceWrapper('template-4', instanceContext)

      assert.ok(result.includes('nested'))
      assert.ok(result.includes('a'))
      assert.ok(result.includes('b'))
    })

    it('should handle empty instance context', () => {
      const instanceContext = {}

      const result = sm.generateInstanceWrapper('template-5', instanceContext)

      assert.ok(result.includes('values: {}'))
      assert.ok(result.includes('instanceId: \'undefined\''))
    })
  })

  describe('compileAllInstances() - Full Compilation', () => {
    let sm

    beforeEach(() => {
      sm = new ScriptManager()
    })

    it('should compile single instance', async () => {
      await sm.registerTemplate('test', (context) => {
        return context.values.count * 2
      })

      const instances = {
        'inst-1': {
          templateId: 'test',
          instanceId: 'inst-1',
          values: { count: 5 },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
      assert.ok(result.length > 0)
      assert.ok(result.includes('async'))
    })

    it('should compile multiple instances with shared template', async () => {
      await sm.registerTemplate('shared', (context) => {
        return context.values.x + context.values.y
      })

      const instances = {
        'inst-1': {
          templateId: 'shared',
          instanceId: 'inst-1',
          values: {
            x: 1,
            y: 2
          },
          refs: {},
          document: {}
        },
        'inst-2': {
          templateId: 'shared',
          instanceId: 'inst-2',
          values: {
            x: 3,
            y: 4
          },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
      assert.ok(result.length > 0)
    })

    it('should compile multiple instances with different templates', async () => {
      await sm.registerTemplate('template1', (context) => context.values.a)
      await sm.registerTemplate('template2', (context) => context.values.b)

      const instances = {
        'inst-1': {
          templateId: 'template1',
          instanceId: 'inst-1',
          values: { a: 1 },
          refs: {},
          document: {}
        },
        'inst-2': {
          templateId: 'template2',
          instanceId: 'inst-2',
          values: { b: 2 },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
      assert.ok(result.length > 0)
    })

    it('should include helpers in compiled code', async () => {
      await sm.addHelper('double', (x) => x * 2)
      await sm.registerTemplate('test', (context, helpers) => {
        return helpers.double(context.values.x)
      })

      const instances = {
        'inst-1': {
          templateId: 'test',
          instanceId: 'inst-1',
          values: { x: 5 },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(result.includes('double'))
      assert.ok(result.includes('coraliteTemplateScriptHelpers'))
    })

    it('should handle instances with refs', async () => {
      await sm.registerTemplate('test', (context) => {
        return context.refs.button ? 'found' : 'not found'
      })

      const instances = {
        'inst-1': {
          templateId: 'test',
          instanceId: 'inst-1',
          values: {},
          refs: { button: 'element' },
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
    })

    it('should handle instances with document context', async () => {
      await sm.registerTemplate('test', (context) => {
        return context.document.title || 'no title'
      })

      const instances = {
        'inst-1': {
          templateId: 'test',
          instanceId: 'inst-1',
          values: {},
          refs: {},
          document: { title: 'Test Page' }
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
    })

    it('should handle empty instances object', async () => {
      const result = await sm.compileAllInstances({})

      assert.ok(typeof result === 'string')
      assert.ok(result.length > 0)
    })

    it('should handle instances without shared functions', async () => {
      const instances = {
        'inst-1': {
          templateId: 'nonexistent',
          instanceId: 'inst-1',
          values: {},
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
    })

    it('should handle async shared functions', async () => {
      await sm.registerTemplate('async', async (context) => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return context.values.x
      })

      const instances = {
        'inst-1': {
          templateId: 'async',
          instanceId: 'inst-1',
          values: { x: 42 },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
      assert.ok(result.includes('async'))
    })

    it('should handle complex instance contexts', async () => {
      await sm.addHelper('format', (context) => (value) => {
        return `${context.instanceId}: ${value}`
      })

      await sm.registerTemplate('complex', (context, helpers) => {
        const formatter = helpers.format(context)
        return formatter(context.values.message)
      })

      const instances = {
        'inst-1': {
          templateId: 'complex',
          instanceId: 'inst-1',
          values: { message: 'Hello World' },
          refs: { element: 'div' },
          document: { title: 'Test' }
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
      assert.ok(result.length > 0)
    })

    it('should produce valid JavaScript', async () => {
      await sm.registerTemplate('test', (context) => context.values.x)

      const instances = {
        'inst-1': {
          templateId: 'test',
          instanceId: 'inst-1',
          values: { x: 1 },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      // Should be minified by esbuild
      assert.ok(result.length > 0)
      assert.ok(!result.includes('\n\n')) // No excessive newlines
    })
  })

  describe('Integration Tests', () => {
    it('should handle full workflow: plugin → helper → template → instance → compile', async () => {
      const sm = new ScriptManager()

      // Register plugin with helper
      await sm.use({
        setup: (manager) => {
          // Add a custom property for testing
          manager.customProperty = 'test'
        },
        helpers: {
          add: (a, b) => a + b
        }
      })

      // Add another helper
      await sm.addHelper('multiply', (a, b) => a * b)

      // Register template
      await sm.registerTemplate('calculator', (context, helpers) => {
        const sum = helpers.add(context.values.a, context.values.b)
        const product = helpers.multiply(sum, context.values.multiplier)
        return product
      })

      // Compile instances
      const instances = {
        'calc-1': {
          templateId: 'calculator',
          instanceId: 'calc-1',
          values: {
            a: 2,
            b: 3,
            multiplier: 10
          },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)

      assert.ok(typeof result === 'string')
      assert.ok(result.length > 0)
      assert.strictEqual(sm.customProperty, 'test')
    })

    it('should handle multiple plugins with overlapping helpers', async () => {
      const sm = new ScriptManager()

      await sm.use({
        helpers: {
          helper1: () => 'first',
          shared: (x) => x * 2
        }
      })

      await sm.use({
        helpers: {
          helper2: () => 'second',
          shared: (x) => x * 3 // Should overwrite
        }
      })

      assert.strictEqual(Object.keys(sm.helpers).length, 3)
      assert.ok(sm.helpers.helper1)
      assert.ok(sm.helpers.helper2)
      assert.ok(sm.helpers.shared)
    })

    it('should handle method chaining throughout', async () => {
      const sm = new ScriptManager()

      await sm.use({ helpers: { h1: () => 1 } })
      await sm.addHelper('h2', () => 2)
      await sm.registerTemplate('t1', () => 'test')

      assert.ok(sm.helpers.h1)
      assert.ok(sm.helpers.h2)
      assert.ok(sm.sharedFunctions.has('t1'))
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

    it('should handle plugin with empty helpers object', async () => {
      await sm.use({ helpers: {} })
      assert.strictEqual(Object.keys(sm.helpers).length, 0)
    })

    it('should handle helper with no name', async () => {
      await sm.addHelper('', () => 'test')
      assert.ok(sm.helpers[''])
    })

    it('should handle template with non-function script', async () => {
      await sm.registerTemplate('test', 123)
      const registered = sm.sharedFunctions.get('test')
      assert.strictEqual(registered.script, 123)
    })

    it('should handle instance with missing properties', async () => {
      await sm.registerTemplate('test', () => 'test')

      const instances = {
        'inst-1': {
          templateId: 'test'
          // Missing values, refs, document
        }
      }

      const result = await sm.compileAllInstances(instances)
      assert.ok(typeof result === 'string')
    })

    it('should handle very large number of instances', async () => {
      await sm.registerTemplate('test', (context) => context.values.x)

      const instances = {}
      for (let i = 0; i < 100; i++) {
        instances[`inst-${i}`] = {
          templateId: 'test',
          values: { x: i },
          refs: {},
          document: {}
        }
      }

      const result = await sm.compileAllInstances(instances)
      assert.ok(typeof result === 'string')
      assert.ok(result.length > 0)
    })

    it('should handle special characters in template IDs', async () => {
      await sm.registerTemplate('template-with-dashes', () => 'test')
      await sm.registerTemplate('template_with_underscores', () => 'test')
      await sm.registerTemplate('template.with.dots', () => 'test')

      assert.ok(sm.sharedFunctions.has('template-with-dashes'))
      assert.ok(sm.sharedFunctions.has('template_with_underscores'))
      assert.ok(sm.sharedFunctions.has('template.with.dots'))
    })

    it('should handle special characters in helper names', async () => {
      await sm.addHelper('$private', () => 'private')
      await sm.addHelper('_internal', () => 'internal')
      await sm.addHelper('helper$With$Dollars', () => 'dollars')

      assert.ok(sm.helpers.$private)
      assert.ok(sm.helpers._internal)
      assert.ok(sm.helpers.helper$With$Dollars)
    })

    it('should handle helpers that return complex objects', async () => {
      const complexHelper = () => ({
        nested: { value: 42 },
        array: [1, 2, 3],
        method: () => 'test'
      })

      await sm.addHelper('complex', complexHelper)

      assert.ok(sm.helpers.complex)
      assert.ok(sm.helpers.complex.includes('nested'))
    })

    it('should handle template that uses all context properties', async () => {
      await sm.registerTemplate('full', (context) => {
        return `${context.instanceId}-${context.templateId}-${context.values.x}-${context.refs.el}-${context.document.title}`
      })

      const instances = {
        'inst-1': {
          templateId: 'full',
          values: { x: 1 },
          refs: { el: 'div' },
          document: { title: 'Test' }
        }
      }

      const result = await sm.compileAllInstances(instances)
      assert.ok(typeof result === 'string')
    })
  })
})
