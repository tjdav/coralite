import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'

describe('definePlugin', () => {
  it('should validate basic plugin state', () => {
    const plugin = definePlugin({
      name: 'test-plugin',
      server: {
        context: () => {
          return {
            test: () => {
            }
          }
        }
      }
    })

    assert.strictEqual(plugin.name, 'test-plugin')
    assert.strictEqual(typeof plugin.server.context, 'function')
  })

  it('should receive context and config in server.context', async () => {
    let capturedContext = null
    const plugin = definePlugin({
      name: 'test-plugin',
      server: {
        config: { foo: 'bar' },
        context: (context) => {
          capturedContext = context
          return {
            test: () => {
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
    // Protocol updated to snapshot instead of prototype to avoid pollution
    assert.notStrictEqual(Object.getPrototypeOf(capturedContext), serverGlobalContext)
  })
})
