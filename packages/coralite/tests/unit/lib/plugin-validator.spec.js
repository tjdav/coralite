import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validatePluginSource,
  validatePluginObject,
  validatePluginFile,
  validatePluginsDir,
  formatPluginValidationReport,
  findOuterScopeReferences
} from '../../../lib/plugin-validator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('plugin-validator.js', () => {
  describe('findOuterScopeReferences', () => {
    it('should detect free outer-scope references in functions when moduleBindings is provided', () => {
      const outerHelper = () => {}
      function sampleFn (ctx) {
        const local = 123
        console.log(local)
        // @ts-ignore
        return outerHelper(local)
      }

      const refs = findOuterScopeReferences(sampleFn, { moduleBindings: ['outerHelper'] })
      assert.equal(refs.length, 1)
      assert.equal(refs[0].name, 'outerHelper')
    })

    it('should return empty array if moduleBindings is omitted or empty', () => {
      function sampleFn () {
        // @ts-ignore
        return outerHelper(123)
      }

      const refs = findOuterScopeReferences(sampleFn)
      assert.equal(refs.length, 0)
    })

    it('should ignore ambient Web / DOM / browser APIs when moduleBindings is provided', () => {
      function sampleFn () {
        const target = new EventTarget()
        const evt = new CustomEvent('test', { detail: 123 })
        alert('hello')
        prompt('enter')
        const notif = new Notification('hi')
        const enc = new VideoEncoder({ output: () => {}, error: () => {} })
        const dec = new TextDecoder()
        const err = new DOMException('msg')
        const encoded = btoa('text')
        // @ts-ignore
        window.customMethod()
        console.log(target, evt, notif, enc, dec, err, encoded)
      }

      const refs = findOuterScopeReferences(sampleFn, { moduleBindings: ['myModuleVar'] })
      assert.equal(refs.length, 0)
    })

    it('should honor @coralite-ignore pragma for specific symbols', () => {
      const source = `
        /* @coralite-ignore outerHelper */
        function testFn() {
          return outerHelper() + 1;
        }
      `
      const refs = findOuterScopeReferences(source, { moduleBindings: ['outerHelper'] })
      assert.equal(refs.length, 0)
    })

    it('should honor @coralite-ignore-serialization wildcard pragma', () => {
      const source = `
        // @coralite-ignore-serialization
        function testFn() {
          return freeVar1 + freeVar2;
        }
      `
      const refs = findOuterScopeReferences(source, { moduleBindings: ['freeVar1', 'freeVar2'] })
      assert.equal(refs.length, 0)
    })
  })

  describe('validatePluginSource diagnostic rules (CORALITE-P101 - CORALITE-P401)', () => {
    it('should validate a clean, correct plugin source code with definePlugin', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'valid-test-plugin',
          server: {
            context: (pluginContext) => (instanceContext) => ({ foo: 1 }),
            onBeforeBuild () { console.log('build') }
          },
          client: {
            context: (pluginContext) => (instanceContext) => ({ bar: 2 }),
            onConnected () { console.log('connected') }
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, true)
      assert.equal(result.pluginName, 'valid-test-plugin')
      assert.equal(result.metrics.errors, 0)
      assert.equal(result.diagnostics.length, 0)
    })

    it('CORALITE-P101: should flag missing or empty plugin name', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          server: {}
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P101'))
      const diag = result.diagnostics.find(d => d.code === 'CORALITE-P101')
      assert.ok(diag.codeframe.includes('definePlugin'))
      assert.ok(diag.cause)
    })

    it('CORALITE-P102: should warn on reserved plugin names', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'testing'
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, true)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P102' && d.severity === 'warning'))
    })

    it('CORALITE-P201: should flag context function that is not Two-Phase curried', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'single-phase-plugin',
          server: {
            context: (ctx) => ({ count: 1 })
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P201'))
      const diag = result.diagnostics.find(d => d.code === 'CORALITE-P201')
      assert.equal(diag.fix.action, 'wrap_two_phase_context')
    })

    it('CORALITE-P202: should flag invalid server hook signature', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'invalid-hook-plugin',
          server: {
            onBeforeBuild: 'not-a-function'
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P202'))
    })

    it('CORALITE-P203: should flag server-only module referenced in client block', () => {
      const source = `
        import { definePlugin } from 'coralite'
        import fs from 'node:fs'

        export default definePlugin({
          name: 'leaky-plugin',
          client: {
            onConnected () {
              const data = fs.readFileSync('test')
            }
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P203'))
    })

    it('CORALITE-P301: should flag outer-scope variable reference in client block', () => {
      const source = `
        import { definePlugin } from 'coralite'
        const helperFn = (x) => x * 2;

        export default definePlugin({
          name: 'leaky-context-plugin',
          client: {
            onConnected () {
              const val = helperFn(10)
            }
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P301'))
    })

    it('CORALITE-P302: should flag non-serializable client.config', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'bad-config-plugin',
          client: {
            config: () => {}
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P302'))
    })

    it('CORALITE-P303: should flag invalid client hook signature', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'bad-client-hook-plugin',
          client: {
            onConnected: 123
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P303'))
    })

    it('CORALITE-P401: should warn when plugin source does not call definePlugin', () => {
      const source = `
        export default {
          name: 'raw-object-plugin',
          server: {}
        }
      `
      const result = validatePluginSource(source, 'test.js')
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P401' && d.severity === 'warning'))
      const diag = result.diagnostics.find(d => d.code === 'CORALITE-P401')
      assert.equal(diag.fix.action, 'wrap_define_plugin')
    })
  })

  describe('validatePluginObject', () => {
    it('should validate valid plugin object', () => {
      const plugin = {
        name: 'my-plugin',
        server: {
          onBeforeBuild () {
            // noop
          }
        },
        client: {
          config: { theme: 'dark' }
        }
      }
      const result = validatePluginObject(plugin, 'my-plugin.js')
      assert.equal(result.valid, true)
      assert.equal(result.metrics.errors, 0)
    })

    it('should skip closure leak checks in validatePluginObject when module AST is absent', () => {
      const outerVar = 'secret'
      const plugin = {
        name: 'runtime-plugin',
        client: {
          context () {
            // @ts-ignore
            return () => ({ outerVar })
          }
        }
      }
      const result = validatePluginObject(plugin, 'runtime-plugin.js')
      assert.equal(result.valid, true)
      assert.equal(result.metrics.errors, 0)
    })

    it('should detect non-serializable client config', () => {
      const plugin = {
        name: 'bad-config-plugin',
        client: {
          config: {
            handler: () => {
              // noop
            }
          }
        }
      }
      const result = validatePluginObject(plugin, 'bad-plugin.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P302'))
    })

    it('should detect invalid hook types', () => {
      const plugin = {
        name: 'bad-hook-plugin',
        server: {
          // @ts-ignore
          onBeforeBuild: 'not-a-function'
        }
      }
      const result = validatePluginObject(plugin, 'bad-plugin.js')
      assert.equal(result.valid, false)
      assert.ok(result.diagnostics.some(d => d.code === 'CORALITE-P202'))
    })
  })

  describe('validatePluginFile & validatePluginsDir', () => {
    it('should validate plugin file on disk', async () => {
      const fixturePath = join(__dirname, '../../fixtures/plugins/mock-plugin.js')
      const result = await validatePluginFile(fixturePath)
      assert.equal(result.valid, true)
      assert.equal(result.pluginName, 'mock-plugin')
    })

    it('should throw Error when validating missing plugin file', async () => {
      const missingPath = join(__dirname, '../../fixtures/plugins/non-existent-plugin.js')
      await assert.rejects(
        () => validatePluginFile(missingPath),
        { message: `Plugin file not found: ${missingPath}` }
      )
    })

    it('should throw Error when validating missing plugins directory', async () => {
      const missingDir = join(__dirname, '../../fixtures/plugins/non-existent-dir')
      await assert.rejects(
        () => validatePluginsDir(missingDir),
        { message: `Plugins directory not found: ${missingDir}` }
      )
    })

    it('should validate directory of plugins', async () => {
      const fixturesDir = join(__dirname, '../../fixtures/plugins')
      const report = await validatePluginsDir(fixturesDir)
      assert.ok(report.metrics.totalPlugins > 0)
      assert.ok(report.plugins.some(p => p.pluginName === 'mock-plugin' && p.valid === true))
    })

    it('should format report into console and JSON formats', async () => {
      const report = {
        plugins: [{
          filePath: 'test/plugin.js',
          pluginName: 'test-plugin',
          valid: true,
          issues: [],
          diagnostics: [],
          metrics: {
            errors: 0,
            warnings: 0
          }
        }],
        metrics: {
          totalPlugins: 1,
          validPlugins: 1,
          totalErrors: 0,
          totalWarnings: 0
        }
      }

      const json = formatPluginValidationReport(report, { format: 'json' })
      assert.ok(json.includes('"test-plugin"'))

      const consoleOut = formatPluginValidationReport(report, { format: 'console' })
      assert.ok(consoleOut.includes('Coralite Plugin Validation Report'))
    })
  })
})
