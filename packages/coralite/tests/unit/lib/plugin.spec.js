import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'

describe('definePlugin', () => {
  it('should validate basic plugin state', () => {
    const plugin = definePlugin({
      name: 'test-plugin',
      server: {
        exports: {
          test: (context) => () => {
          }
        }
      }
    })

    assert.strictEqual(plugin.name, 'test-plugin')
    assert.strictEqual(typeof plugin.server.exports, 'object')
    assert.strictEqual(typeof plugin.server.exports.test, 'function')
  })

  it('should receive context and config in Phase 1', async () => {
    let capturedContext = null
    const plugin = definePlugin({
      name: 'test-plugin',
      server: {
        config: { foo: 'bar' },
        exports: {
          test: (context) => {
            capturedContext = context
            return () => {
            }
          }
        }
      }
    })

    const { setupPlugins } = await import('../../../lib/plugin-setup.js')
    const app = { options: { plugins: [plugin] } }
    const serverGlobalContext = { global: true }
    const source = { plugins: {} }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: {}
      },
      scriptManager: {
        use: () => {
        }
      },
      source
    })

    assert.ok(capturedContext)
    assert.strictEqual(capturedContext.global, true)
    assert.strictEqual(capturedContext.config.foo, 'bar')
    assert.strictEqual(Object.getPrototypeOf(capturedContext), serverGlobalContext)
  })
})
