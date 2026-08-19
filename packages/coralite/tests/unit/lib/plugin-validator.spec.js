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

  describe('validatePluginSource', () => {
    it('should validate a clean, correct plugin source code', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'valid-test-plugin',
          server: {
            onBeforeBuild () { console.log('build') }
          },
          client: {
            onConnected () { console.log('connected') }
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, true)
      assert.equal(result.pluginName, 'valid-test-plugin')
      assert.equal(result.metrics.errors, 0)
    })

    it('should flag missing plugin name', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          server: {}
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.issues.some(i => i.code === 'MISSING_PLUGIN_NAME'))
    })

    it('should warn on reserved plugin names', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default definePlugin({
          name: 'testing'
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, true)
      assert.ok(result.issues.some(i => i.code === 'RESERVED_PLUGIN_NAME'))
    })

    it('should allow ambient browser APIs and eventBus in client.context and hooks without false positives', () => {
      const source = `
        import { definePlugin } from 'coralite'

        export default definePlugin({
          name: 'eventBus',
          client: {
            context (pluginContext) {
              const hub = new EventTarget()
              return () => ({
                on: (event, handler) => hub.addEventListener(event, handler),
                emit: (event, detail) => hub.dispatchEvent(new CustomEvent(event, { detail }))
              })
            },
            onConnected () {
              alert('connected')
              prompt('input')
              new Notification('test')
              new VideoEncoder({ output: () => {}, error: () => {} })
              new TextDecoder()
              new DOMException('err')
              btoa('abc')
              window.customMethod()
            }
          }
        })
      `
      const result = validatePluginSource(source, 'event-bus.js')
      assert.equal(result.valid, true)
      assert.equal(result.metrics.errors, 0)
    })

    it('should detect serialization boundary leaks in client.context for top-level declarations', () => {
      const source = `
        import { definePlugin } from 'coralite'
        const helperFn = (x) => x * 2;

        export default definePlugin({
          name: 'leaky-context-plugin',
          client: {
            context () {
              const val = helperFn(10)
              return () => ({ val })
            }
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.issues.some(i => i.code === 'SERIALIZATION_BOUNDARY_LEAK'))
      assert.ok(result.issues.some(i => i.message.includes('helperFn')))
    })

    it('should flag factory parameter closure leaks inside factory functions', () => {
      const source = `
        import { definePlugin } from 'coralite'

        export default function myPlugin (options) {
          const secret = options.apiKey
          return definePlugin({
            name: 'factory-leak-plugin',
            client: {
              context () {
                console.log(options.apiKey, secret)
                return () => ({})
              }
            }
          })
        }
      `
      const result = validatePluginSource(source, 'factory-leak.js')
      assert.equal(result.valid, false)
      assert.ok(result.issues.some(i => i.code === 'SERIALIZATION_BOUNDARY_LEAK' && i.message.includes('options')))
      assert.ok(result.issues.some(i => i.code === 'SERIALIZATION_BOUNDARY_LEAK' && i.message.includes('secret')))
    })

    it('should flag isomorphic scope leaks (importing fs inside client block)', () => {
      const source = `
        import { definePlugin } from 'coralite'
        import fs from 'node:fs'

        export default definePlugin({
          name: 'leaky-plugin',
          client: {
            context () {
              const data = fs.readFileSync('test')
              return () => ({ data })
            }
          }
        })
      `
      const result = validatePluginSource(source, 'test.js')
      assert.equal(result.valid, false)
      assert.ok(result.issues.some(i => i.code === 'ISOMORPHIC_SCOPE_LEAK'))
    })

    it('should validate plugin factory functions (higher order functions)', () => {
      const source = `
        import { definePlugin } from 'coralite'
        export default function myPluginFactory (options = {}) {
          return definePlugin({
            name: 'factory-plugin',
            server: {
              onBeforeBuild () { console.log('build') }
            }
          })
        }
      `
      const result = validatePluginSource(source, 'factory-plugin.js')
      assert.equal(result.valid, true)
      assert.equal(result.pluginName, 'factory-plugin')
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
      assert.ok(result.issues.some(i => i.code === 'NON_SERIALIZABLE_CLIENT_CONFIG'))
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
      assert.ok(result.issues.some(i => i.code === 'INVALID_HOOK_TYPE'))
    })
  })

  describe('validatePluginFile & validatePluginsDir', () => {
    it('should validate plugin file on disk', async () => {
      const fixturePath = join(__dirname, '../../fixtures/plugins/mock-plugin.js')
      const result = await validatePluginFile(fixturePath)
      assert.equal(result.valid, true)
      assert.equal(result.pluginName, 'mock-plugin')
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
