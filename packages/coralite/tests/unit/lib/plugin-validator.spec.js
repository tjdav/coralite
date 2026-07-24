import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import {
  validatePluginSource,
  validatePluginObject,
  validatePluginFile,
  validatePluginsDir,
  formatPluginValidationReport
} from '../../../lib/plugin-validator.js'

describe('plugin-validator.js', () => {
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
      const fixturePath = join(process.cwd(), 'tests/fixtures/plugins/mock-plugin.js')
      const result = await validatePluginFile(fixturePath)
      assert.equal(result.valid, true)
      assert.equal(result.pluginName, 'mock-plugin')
    })

    it('should validate directory of plugins', async () => {
      const fixturesDir = join(process.cwd(), 'tests/fixtures/plugins')
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
