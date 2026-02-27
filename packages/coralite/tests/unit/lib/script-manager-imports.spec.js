import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { ScriptManager } from '#lib'

describe('ScriptManager Imports', () => {
  it('should compile plugin with imports and attributes', async () => {
    const sm = new ScriptManager()

    const plugin = {
      name: 'test-plugin',
      imports: [
        {
          specifier: './tests/fixtures/dummy-client-lib.js',
          namedExports: ['foo']
        },
        {
          specifier: './package.json',
          defaultExport: 'pkg',
          attributes: { type: 'json' }
        }
      ],
      helpers: {
        testHelper: function () {
          // access imported values
          console.log(foo, pkg.name)
        }
      }
    }

    await sm.use(plugin)

    sm.registerTemplate('test', { content: '() => {}' })

    const instances = {
      'inst-1': {
        templateId: 'test',
        instanceId: 'inst-1',
        values: {},
        refs: {},
        document: {}
      }
    }

    try {
      const output = await sm.compileAllInstances(instances)

      // Verify that the output is generated (build success)
      assert.ok(output.length > 0)

      // Verify helper presence
      assert.ok(output.includes('testHelper'), 'Output should contain testHelper')

      // Verify usage of imported modules (esbuild will bundle them, so we check for content)
      // dummy-client-lib.js contains "export const foo = 'foo';"
      // package.json contains "coralite" (name)

      assert.ok(output.includes('foo'), 'Output should contain bundled foo from dummy-client-lib')
      assert.ok(output.includes('coralite'), 'Output should contain bundled package.json content')

    } catch (err) {
      assert.fail(`Compilation failed: ${err.message}`)
    }
  })

  it('should compile plugin with default and named exports mixed', async () => {
    const sm = new ScriptManager()

    const plugin = {
      name: 'test-mixed',
      imports: [
        {
          specifier: './tests/fixtures/dummy-client-lib.js',
          defaultExport: 'DummyDefault',
          namedExports: ['foo']
        }
      ],
      helpers: {
        check: function () {
          console.log(DummyDefault, foo)
        }
      }
    }

    await sm.use(plugin)
    sm.registerTemplate('test', { content: '() => {}' })

    const instances = {
      'inst-1': {
        templateId: 'test',
        instanceId: 'inst-1',
        values: {},
        refs: {},
        document: {}
      }
    }

    try {
      const output = await sm.compileAllInstances(instances)
      assert.ok(output.length > 0)
      // Verify default export usage (esbuild bundles it, output should contain 'defaultVal')
      assert.ok(output.includes('defaultVal'), 'Should contain defaultVal')
      assert.ok(output.includes('foo'), 'Should contain foo')
    } catch (err) {
      assert.fail(`Compilation failed: ${err.message}`)
    }
  })
})
