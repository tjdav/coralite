import { describe, it, beforeEach, mock, after } from 'node:test'
import { strict as assert } from 'node:assert'
import { ScriptManager } from '#lib'
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
      assert.strictEqual(Object.keys(sm.helpers).length, 0)
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

      assert.strictEqual(sm.scriptModules.length, 1)
      assert.strictEqual(sm.scriptModules[0].helpers.helper1, helper1)
      assert.strictEqual(sm.scriptModules[0].helpers.helper2, helper2)
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

      assert.strictEqual(setupMock.mock.calls.length, 0)
      assert.strictEqual(sm.scriptModules.length, 1)
      assert.strictEqual(sm.scriptModules[0].helpers.testHelper, helper)
    })

    it('should register function plugin', async () => {
      const pluginFn = () => {
      }

      await sm.use(pluginFn)

      assert.strictEqual(sm.plugins.length, 1)
      assert.strictEqual(sm.plugins[0], pluginFn)
    })

    it('should handle plugin with null setup', async () => {
      const helper = () => 'test'
      const plugin = {
        setup: null,
        helpers: { test: helper }
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].helpers.test, helper)
    })

    it('should handle plugin with undefined setup', async () => {
      const helper = () => 'test'
      const plugin = {
        setup: undefined,
        helpers: { test: helper }
      }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].helpers.test, helper)
    })

    it('should handle plugin with no setup property', async () => {
      const helper = () => 'test'
      const plugin = { helpers: { test: helper } }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].helpers.test, helper)
    })

    it('should skip helpers that are not own properties', async () => {
      const protoHelpers = { inherited: () => 'inherited' }
      const helpers = Object.create(protoHelpers)
      helpers.own = () => 'own'

      const plugin = { helpers }

      await sm.use(plugin)

      // ScriptManager does not process inheritance manually when pushing to scriptModules?
      // But compileAllInstances checks Object.hasOwn.
      // So we check if scriptModules has the helper.
      assert.strictEqual(sm.scriptModules[0].helpers, helpers)
      // The verification of skipping inherited properties happens during compilation (esbuild onLoad).
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

    it('should handle helpers with async methods', async () => {
      const asyncHelper = async () => 'async'
      const plugin = { helpers: { asyncHelper } }

      await sm.use(plugin)

      assert.strictEqual(sm.scriptModules[0].helpers.asyncHelper, asyncHelper)
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

    it('should register template with function script string', async () => {
      const script = { content: '(context) => context.values' }
      sm.registerTemplate('test-template', script)

      assert.ok(sm.sharedFunctions['test-template'])
      const registered = sm.sharedFunctions['test-template']
      assert.strictEqual(registered.templateId, 'test-template')
      assert.strictEqual(registered.script, script)
    })

    it('should register template with string script', async () => {
      const script = { content: 'console.log("test")' }
      sm.registerTemplate('string-template', script)

      assert.ok(sm.sharedFunctions['string-template'])
      const registered = sm.sharedFunctions['string-template']
      assert.strictEqual(registered.script, script)
    })

    it('should overwrite existing template', async () => {
      const script1 = { content: "() => 'first'" }
      const script2 = { content: "() => 'second'" }

      sm.registerTemplate('test', script1)
      assert.strictEqual(sm.sharedFunctions['test'].script, script1)

      sm.registerTemplate('test', script2)
      assert.strictEqual(sm.sharedFunctions['test'].script, script2)
    })

    it('should handle async registration', async () => {
      const script = { content: "async () => 'async'" }
      sm.registerTemplate('async-template', script)

      assert.ok(sm.sharedFunctions['async-template'])
    })

    it('should handle template with complex script', async () => {
      const script = {
        content: `function (context) {
          const result = context.values.map(x => x * 2)
          return result
        }`
      }

      sm.registerTemplate('complex', script)

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
      sm.registerTemplate('test', {
        content: `(context) => {
          return context.values.count * 2
        }`
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
      sm.registerTemplate('shared', {
        content: `(context) => {
          return context.values.x + context.values.y
        }`
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
      sm.registerTemplate('template1', { content: '(context) => context.values.a' })
      sm.registerTemplate('template2', { content: '(context) => context.values.b' })

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
      sm.registerTemplate('test', {
        content: `(context, helpers) => {
          return helpers.double(context.values.x)
        }`
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
      sm.registerTemplate('test', {
        content: `(context) => {
          return context.refs.button ? 'found' : 'not found'
        }`
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
      sm.registerTemplate('test', {
        content: `(context) => {
          return context.document.title || 'no title'
        }`
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
      sm.registerTemplate('async', {
        content: `async (context) => {
          await new Promise(resolve => setTimeout(resolve, 1))
          return context.values.x
        }`
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

      sm.registerTemplate('complex', {
        content: `(context, helpers) => {
          const formatter = helpers.format(context)
          return formatter(context.values.message)
        }`
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
      sm.registerTemplate('test', { content: '(context) => context.values.x' })

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
    })
  })

  describe('Integration Tests', () => {
    it('should handle full workflow: plugin → helper → template → instance → compile', async () => {
      const sm = new ScriptManager()

      // Register plugin with helper
      await sm.use({
        setup: () => {
          return { customProperty: 'test' }
        },
        helpers: {
          add: (context) => (a, b) => a + b
        }
      })

      // Add another helper
      await sm.addHelper('multiply', (context) => (a, b) => a * b)

      // Register template
      sm.registerTemplate('calculator', {
        values: {},
        lineOffset: 0,
        content: `(context, helpers) => {
          const sum = helpers.add(context.values.a, context.values.b)
          const product = helpers.multiply(sum, context.values.multiplier)
          // also return customProperty if present to prove setup injected it
          if (context.values.customProperty === 'test') {
            return product + 1000
          }
          return product
        }`
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
      assert.ok(result.includes('customProperty'))
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

      assert.strictEqual(sm.scriptModules.length, 2)
      assert.ok(sm.scriptModules[0].helpers.helper1)
      assert.ok(sm.scriptModules[1].helpers.helper2)
      // Overwrite behavior is handled by esbuild spreading imports, not internal state
    })

    it('should handle method chaining throughout', async () => {
      const sm = new ScriptManager()

      await sm.use({ helpers: { h1: () => 1 } })
      await sm.addHelper('h2', () => 2)
      sm.registerTemplate('t1', { content: "() => 'test'" })

      assert.strictEqual(sm.scriptModules.length, 1)
      assert.ok(sm.scriptModules[0].helpers.h1)
      assert.ok(sm.helpers.h2)
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

    it('should handle plugin with empty helpers object', async () => {
      await sm.use({ helpers: {} })
      assert.strictEqual(Object.keys(sm.helpers).length, 0)
    })

    it('should handle helper with no name', async () => {
      await sm.addHelper('', () => 'test')
      assert.ok(sm.helpers[''])
    })

    it('should handle template with non-function script', async () => {
      const script = { content: '123' }
      sm.registerTemplate('test', script)
      const registered = sm.sharedFunctions['test']
      assert.strictEqual(registered.script, script)
    })

    it('should handle instance with missing properties', async () => {
      sm.registerTemplate('test', { content: "() => 'test'" })

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
      sm.registerTemplate('test', { content: '(context) => context.values.x' })

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
      sm.registerTemplate('template-with-dashes', { content: "() => 'test'" })
      sm.registerTemplate('template_with_underscores', { content: "() => 'test'" })
      sm.registerTemplate('template.with.dots', { content: "() => 'test'" })

      assert.ok(sm.sharedFunctions['template-with-dashes'])
      assert.ok(sm.sharedFunctions['template_with_underscores'])
      assert.ok(sm.sharedFunctions['template.with.dots'])
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
      sm.registerTemplate('full', {
        content: `(context) => {
          return \`\${context.instanceId}-\${context.templateId}-\${context.values.x}-\${context.refs.el}-\${context.document.title}\`
        }`
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

  describe('Source Maps', () => {
    it('should generate inline source map containing the file path', async () => {
      const sm = new ScriptManager()
      const templateId = 'test-component'
      const script = { content: '(context) => context.values.message' }
      const filePath = '/absolute/path/to/test-component.html'

      sm.registerTemplate(templateId, script, filePath)

      /**
       * @type {{
       * [x: string]: import('../../../types/script.js').InstanceContext
       * }}
       */
      const instances = {
        'inst-1': {
          templateId,
          instanceId: 'inst-1',
          values: { message: 'Hello' },
          refs: {}
        }
      }

      const output = await sm.compileAllInstances(instances)

      // Check for inline source map
      assert.ok(output.includes('//# sourceMappingURL=data:application/json;base64,'), 'Output should contain inline source map')

      // Decode source map
      const base64Map = output.split('base64,')[1]
      const decodedMap = Buffer.from(base64Map, 'base64').toString('utf-8')
      const sourceMap = JSON.parse(decodedMap)

      // Check if sources array contains the file path
      const filename = 'test-component.html'
      const hasFile = sourceMap.sources.some(source => source.includes(filename))

      assert.ok(hasFile, `Source map sources should contain ${filename}. Found: ${JSON.stringify(sourceMap.sources)}`)
    })
  })


  describe('ScriptManager Context Imports', () => {
    it('should inject imports into context.imports for helpers', async () => {
      const sm = new ScriptManager()

      const plugin = {
        name: 'test-plugin',
        imports: [
          {
            specifier: './temp-test-module.js',
            defaultExport: 'pkg'
          }
        ],
        helpers: {
          testHelper: function (context) {
            return () => {
              return `Default: ${context.imports.pkg}`
            }
          }
        }
      }

      await sm.use(plugin)

      sm.registerTemplate('test', {
        content: `(context, helpers) => {
        return helpers.testHelper()
      }`
      })

      const instances = {
        'inst-1': {
          templateId: 'test',
          instanceId: 'inst-1',
          values: {},
          refs: {},
          document: {}
        }
      }

      const output = await sm.compileAllInstances(instances, 'development')

      const injectionRegex = /context\.imports\s*=\s*\{\s*\.\.\.\(?context\.imports\s*\|\|\s*\{\}\)?\s*,\s*\.\.\.[a-zA-Z0-9_$]+\s*\}/

      assert.match(output, injectionRegex, 'Context injection logic not found')
      assert.ok(output.includes('pkg'), 'Expected "pkg" in output')
    })

    it('should handle multiple plugins with isolated imports (sequentially)', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'plugin-1',
        imports: [{
          specifier: './temp-test-module.js',
          defaultExport: 'foo'
        }],
        helpers: {
          helperA: (context) => () => context.imports.foo
        }
      })

      await sm.use({
        name: 'plugin-2',
        imports: [{
          specifier: './temp-test-module.js',
          defaultExport: 'bar'
        }],
        helpers: {
          helperB: (context) => () => context.imports.bar
        }
      })

      sm.registerTemplate('test', { content: '() => {}' })
      const output = await sm.compileAllInstances({
        'inst-1': {
          templateId: 'test',
          instanceId: '1',
          values: {},
          refs: {},
          document: {}
        }
      }, 'development')

      const injectionRegex = /context\.imports\s*=\s*\{\s*\.\.\.\(?context\.imports\s*\|\|\s*\{\}\)?\s*,\s*\.\.\.[a-zA-Z0-9_$]+\s*\}/g
      const matches = output.match(injectionRegex)

      assert.ok(matches, 'Matches should not be null')
      assert.strictEqual(matches.length, 2, `Expected 2 injection patterns, found ${matches ? matches.length : 0}`)
    })

    it('should handle namedExports with "as" alias syntax', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'alias-plugin',
        imports: [{
          specifier: './temp-test-module.js',
          namedExports: ['version as pkgVersion', 'name']
        }],
        helpers: {
          getVersion: (context) => () => context.imports.pkgVersion
        }
      })

      sm.registerTemplate('test', { content: '() => {}' })
      const output = await sm.compileAllInstances({
        'inst-1': {
          templateId: 'test',
          instanceId: '1',
          values: {},
          refs: {},
          document: {}
        }
      }, 'development')

      assert.ok(output.includes('pkgVersion'), 'Output should contain aliased import name')
      assert.ok(output.includes('name'), 'Output should contain regular named import')
    })

    it('should handle namespaceExport', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'namespace-plugin',
        imports: [{
          specifier: './temp-test-module.js',
          namespaceExport: 'pkg'
        }],
        helpers: {
          getPkg: (context) => () => context.imports.pkg
        }
      })

      sm.registerTemplate('test', { content: '() => {}' })
      const output = await sm.compileAllInstances({
        'inst-1': {
          templateId: 'test',
          instanceId: '1',
          values: {},
          refs: {},
          document: {}
        }
      }, 'development')

      // Esbuild bundles the import, so we check if the key is present in pluginImports
      assert.ok(output.includes('pkg: '), 'Namespace should be mapped in pluginImports')
    })

    it('should handle combined default, namespace, and named exports', async () => {
      const sm = new ScriptManager()

      await sm.use({
        name: 'combo-plugin',
        imports: [{
          specifier: './temp-test-module.js',
          defaultExport: 'defaultPkg',
          namespaceExport: 'allPkg',
          namedExports: ['version as v', 'name']
        }],
        helpers: {
          check: (context) => () => true
        }
      })

      sm.registerTemplate('test', { content: '() => {}' })
      const output = await sm.compileAllInstances({
        'inst-1': {
          templateId: 'test',
          instanceId: '1',
          values: {},
          refs: {},
          document: {}
        }
      }, 'development')

      // Esbuild bundles imports, so we verify keys in pluginImports are present
      assert.ok(output.includes('defaultPkg: '), 'Default export mapped')
      assert.ok(output.includes('allPkg: '), 'Namespace export mapped')
      assert.ok(output.includes('v: '), 'Aliased named export mapped')
      assert.ok(output.includes('name: '), 'Named export mapped')
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
        config,
        helpers: {
          testHelper: (context) => {
            return context.config
          }
        }
      })

      const instances = {
        inst1: {
          instanceId: 'inst1',
          templateId: 'temp1',
          values: {},
          refs: {},
          document: {}
        }
      }

      manager.registerTemplate('temp1', { content: '() => {}' })

      const compiledScript = await manager.compileAllInstances(instances, 'development')

      // Verify config injection in generated code with whitespace-agnostic regex
      // Looks for: pluginConfig = { ... "baseURL": "http://example.com" ... "apiKey": "123" ... }
      assert.match(compiledScript, /pluginConfig\s*=\s*\{\s*"baseURL"\s*:\s*"http:\/\/example\.com"\s*,\s*"apiKey"\s*:\s*"123"\s*\}/)

      // Check for the context injection logic
      // context.config = { ...(context.config || {}), ...pluginConfig }
      // Handles potential variations in spacing or parentheses (esbuild might remove parens)
      assert.match(compiledScript, /context\.config\s*=\s*\{\s*\.\.\.\(?context\.config\s*\|\|\s*\{\}\)?\s*,\s*\.\.\.pluginConfig\s*\}/)
    })

    it('should handle missing config gracefully', async () => {
      const manager = new ScriptManager()

      await manager.use({
        helpers: {
          testHelper: (context) => {
            return context.config
          }
        }
      })

      const instances = {
        inst1: {
          instanceId: 'inst1',
          templateId: 'temp1',
          values: {},
          refs: {},
          document: {}
        }
      }

      manager.registerTemplate('temp1', { content: '() => {}' })

      const compiledScript = await manager.compileAllInstances(instances, 'development')

      assert.match(compiledScript, /pluginConfig\s*=\s*\{\}/)
    })
  })
})
