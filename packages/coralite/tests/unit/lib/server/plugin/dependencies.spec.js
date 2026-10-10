import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'
import { setupPlugins } from '../../../../../lib/server/plugin/setup.js'

describe('plugin dependencies field and topological sorting in setupPlugins', () => {
  it('should topologically sort plugins by dependencies', async () => {
    const pluginA = definePlugin({
      name: 'plugin-a',
      client: {
        init () {
        }
      }
    })

    const pluginB = definePlugin({
      name: 'plugin-b',
      dependencies: ['plugin-a'],
      client: {
        init () {
        }
      }
    })

    const registeredOrder = []
    const app = {
      options: {
        mode: 'development',
        // Registered in reverse order
        plugins: [pluginB(), pluginA()]
      }
    }

    await setupPlugins({
      app,
      serverGlobalContext: {},
      plugins: {
        components: [],
        hooks: {}
      },
      scriptManager: {
        use: (client) => {
          registeredOrder.push(client.name)
        }
      },
      source: { plugins: {} }
    })

    assert.deepStrictEqual(registeredOrder, ['plugin-a', 'plugin-b'])
  })

  it('should throw CORALITE-P205 if dependencies references an unknown plugin', async () => {
    const pluginB = definePlugin({
      name: 'plugin-b',
      dependencies: ['non-existent-plugin']
    })

    const app = {
      options: {
        mode: 'development',
        plugins: [pluginB()]
      }
    }

    await assert.rejects(
      async () => {
        await setupPlugins({
          app,
          serverGlobalContext: {},
          plugins: {
            components: [],
            hooks: {}
          },
          scriptManager: {
            use: () => {
            }
          },
          source: { plugins: {} }
        })
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P205')
        assert.match(err.message, /depends on unknown or unregistered plugin "non-existent-plugin"/)
        return true
      }
    )
  })

  it('should throw CORALITE-P205 if dependency graph contains a cycle', async () => {
    const pluginA = definePlugin({
      name: 'plugin-a',
      dependencies: ['plugin-b']
    })

    const pluginB = definePlugin({
      name: 'plugin-b',
      dependencies: ['plugin-a']
    })

    const app = {
      options: {
        mode: 'development',
        plugins: [pluginA(), pluginB()]
      }
    }

    await assert.rejects(
      async () => {
        await setupPlugins({
          app,
          serverGlobalContext: {},
          plugins: {
            components: [],
            hooks: {}
          },
          scriptManager: {
            use: () => {
            }
          },
          source: { plugins: {} }
        })
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P205')
        assert.match(err.message, /cycle detected/)
        return true
      }
    )
  })

  it('should throw CORALITE-P205 when dependency is skipped due to modes gating', async () => {
    const pluginA = definePlugin({
      name: 'testing-plugin-a',
      modes: ['testing']
    })

    const pluginB = definePlugin({
      name: 'plugin-b',
      dependencies: ['testing-plugin-a']
    })

    // Mode is production, so testing-plugin-a is skipped
    const app = {
      options: {
        mode: 'production',
        plugins: [pluginA(), pluginB()]
      }
    }

    await assert.rejects(
      async () => {
        await setupPlugins({
          app,
          serverGlobalContext: {},
          plugins: {
            components: [],
            hooks: {}
          },
          scriptManager: {
            use: () => {
            }
          },
          source: { plugins: {} }
        })
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P205')
        assert.match(err.message, /depends on unknown or unregistered plugin "testing-plugin-a"/)
        return true
      }
    )
  })
})
