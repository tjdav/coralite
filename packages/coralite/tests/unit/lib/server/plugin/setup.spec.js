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

    // Verify server.config is frozen at setup time, client.config remains mutable staging during build
    assert.strictEqual(Object.isFrozen(registeredPlugin.server.config), true)
    assert.strictEqual(Object.isFrozen(registeredPlugin.client.config), false)

    assert.throws(() => {
      registeredPlugin.server.config.base = '/mutated'
    }, TypeError)
  })

  it('should register plugin with no modes key in all modes', async () => {
    let hookFired = false
    let clientUsed = false

    const plugin = definePlugin({
      name: 'all-modes-plugin',
      server: {
        onBeforeBuild () {
          hookFired = true
        }
      },
      client: {
        context: () => () => ({})
      }
    })

    const app = {
      options: {
        mode: 'production',
        plugins: [plugin()]
      }
    }
    const plugins = {
      components: [],
      hooks: {}
    }
    const scriptManager = {
      use: () => {
        clientUsed = true
      }
    }

    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins,
      scriptManager,
      source: { plugins: {} }
    })

    assert.ok(plugins.hooks.onBeforeBuild)
    await plugins.hooks.onBeforeBuild[0]({})
    assert.strictEqual(hookFired, true)
    assert.strictEqual(clientUsed, true)
  })

  it('should skip plugin registration when mode does not match plugin modes', async () => {
    let hookFired = false
    let clientUsed = false

    const plugin = definePlugin({
      name: 'testing-only-plugin',
      modes: ['testing'],
      server: {
        onBeforeBuild () {
          hookFired = true
        }
      },
      client: {
        context: () => () => ({})
      }
    })

    const app = {
      options: {
        mode: 'production',
        plugins: [plugin()]
      }
    }
    const plugins = {
      components: [],
      hooks: {}
    }
    const scriptManager = {
      use: () => {
        clientUsed = true
      }
    }

    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins,
      scriptManager,
      source: { plugins: {} }
    })

    assert.strictEqual(plugins.hooks.onBeforeBuild, undefined)
    assert.strictEqual(hookFired, false)
    assert.strictEqual(clientUsed, false)
  })

  it('should register plugin when current mode matches plugin modes', async () => {
    let hookFired = false
    let clientUsed = false

    const plugin = definePlugin({
      name: 'testing-only-plugin',
      modes: ['testing'],
      server: {
        onBeforeBuild () {
          hookFired = true
        }
      },
      client: {
        context: () => () => ({})
      }
    })

    const app = {
      options: {
        mode: 'testing',
        plugins: [plugin()]
      }
    }
    const plugins = {
      components: [],
      hooks: {}
    }
    const scriptManager = {
      use: () => {
        clientUsed = true
      }
    }

    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins,
      scriptManager,
      source: { plugins: {} }
    })

    assert.ok(plugins.hooks.onBeforeBuild)
    await plugins.hooks.onBeforeBuild[0]({})
    assert.strictEqual(hookFired, true)
    assert.strictEqual(clientUsed, true)
  })

  it('should register plugin with multiple modes in all matching modes and skip in non-matching', async () => {
    let clientUsedCount = 0

    const plugin = definePlugin({
      name: 'dev-and-testing-plugin',
      modes: ['development', 'testing'],
      client: {
        context: () => () => ({})
      }
    })

    // Development mode -> registers
    const appDev = {
      options: {
        mode: 'development',
        plugins: [plugin()]
      }
    }
    await setupPlugins({
      app: appDev,
      serverGlobalContext: {},
      plugins: {
        components: [],
        hooks: {}
      },
      scriptManager: {
        use: () => {
          clientUsedCount++
        }
      },
      source: { plugins: {} }
    })
    assert.strictEqual(clientUsedCount, 1)

    // Testing mode -> registers
    const appTesting = {
      options: {
        mode: 'testing',
        plugins: [plugin()]
      }
    }
    await setupPlugins({
      app: appTesting,
      serverGlobalContext: {},
      plugins: {
        components: [],
        hooks: {}
      },
      scriptManager: {
        use: () => {
          clientUsedCount++
        }
      },
      source: { plugins: {} }
    })
    assert.strictEqual(clientUsedCount, 2)

    // Production mode -> skipped
    const appProd = {
      options: {
        mode: 'production',
        plugins: [plugin()]
      }
    }
    await setupPlugins({
      app: appProd,
      serverGlobalContext: {},
      plugins: {
        components: [],
        hooks: {}
      },
      scriptManager: {
        use: () => {
          clientUsedCount++
        }
      },
      source: { plugins: {} }
    })
    assert.strictEqual(clientUsedCount, 2)
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
