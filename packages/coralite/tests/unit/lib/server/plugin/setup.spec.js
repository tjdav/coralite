import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'
import { setupPlugins } from '../../../../../lib/server/plugin/setup.js'

describe('setupPlugins value routing and object freezing', () => {
  it('should route config values correctly to server.config and client.config and freeze both', async () => {
    const plugin = definePlugin({
      name: 'router',
      config: {
        base: {
          type: String,
          default: '/app'
        }
      },
      server: {
        config: {
          serverOnly: {
            type: String,
            default: 'secret'
          }
        },
        context: () => () => ({})
      },
      client: {
        config: {
          clientOnly: {
            type: Boolean,
            default: true
          }
        },
        context: () => () => ({})
      }
    })

    const app = { options: { plugins: [plugin({ base: '/custom' })] } }
    const serverGlobalContext = {}
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

    const registeredPlugin = app.options.plugins[0]

    // Shared config in both
    assert.strictEqual(registeredPlugin.server.config.base, '/custom')
    assert.strictEqual(registeredPlugin.client.config.base, '/custom')

    // Server-only key only in server.config
    assert.strictEqual(registeredPlugin.server.config.serverOnly, 'secret')
    assert.strictEqual(registeredPlugin.client.config.serverOnly, undefined)

    // Client-only key only in client.config
    assert.strictEqual(registeredPlugin.client.config.clientOnly, true)
    assert.strictEqual(registeredPlugin.server.config.clientOnly, undefined)

    // Verify both are frozen
    assert.strictEqual(Object.isFrozen(registeredPlugin.server.config), true)
    assert.strictEqual(Object.isFrozen(registeredPlugin.client.config), true)

    assert.throws(() => {
      registeredPlugin.server.config.base = '/mutated'
    }, TypeError)

    assert.throws(() => {
      registeredPlugin.client.config.base = '/mutated'
    }, TypeError)
  })

  it('should throw CORALITE-P101 at setup time if bare plugin with required key is registered uncalled', async () => {
    const plugin = definePlugin({
      name: 'auth',
      server: {
        config: {
          token: {
            type: String,
            required: true
          }
        }
      }
    })

    const app = { options: { plugins: [plugin] } }
    const serverGlobalContext = {}
    const source = { plugins: {} }

    await assert.rejects(
      async () => {
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
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P101')
        assert.match(err.message, /token/)
        return true
      }
    )
  })
})
