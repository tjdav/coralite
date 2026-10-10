import { describe, it, before } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'
import { setupPlugins } from '../../../../../lib/server/plugin/setup.js'
import { createRenderer } from '../../../../../lib/server/renderer.js'
import { initHasher } from '../../../../../lib/server/utils/manifest.js'
import { triggerPluginHook, triggerPluginAggregateHook, bindPlugins } from '../../../../../lib/server/hooks.js'

function createMockApp (pluginsList = []) {
  return {
    options: {
      plugins: pluginsList,
      mode: 'development',
      baseURL: '/',
      path: {
        pages: '/pages',
        components: '/components'
      }
    },
    pages: {
      getItem: () => null,
      setItem: async () => ({}),
      list: []
    },
    components: {
      getItem: () => null,
      list: []
    },
    _dependencyGraph: {
      pageCustomElements: {},
      directPageComponents: {}
    },
    _refreshDependencyGraph: () => {
    }
  }
}

function createHooksHelper (app, serverGlobalContext, pluginHooksObj) {
  return {
    async trigger (name, initialData) {
      return await triggerPluginHook({
        app,
        hooks: pluginHooksObj,
        serverGlobalContext,
        name,
        initialData
      })
    },
    async triggerAggregate (name, contextData) {
      return await triggerPluginAggregateHook({
        app,
        hooks: pluginHooksObj,
        serverGlobalContext,
        name,
        contextData
      })
    },
    async bind (pluginFactories, instanceContext) {
      return bindPlugins({
        pluginFactories,
        instanceContext,
        app
      })
    },
    hasComponentRenderHooks () {
      return false
    }
  }
}

function createEmptyHooksObj () {
  return {
    onBeforeBuild: [],
    onAfterBuild: [],
    onPageSet: [],
    onPageDelete: [],
    onPageUpdate: [],
    onComponentSet: [],
    onComponentDelete: [],
    onComponentUpdate: [],
    onBeforePageRender: [],
    onAfterPageRender: [],
    onBeforeComponentRender: [],
    onAfterComponentRender: []
  }
}

describe('Late-bound client.config values', () => {
  before(async () => {
    await initHasher()
  })

  it('writing a declared key to config.clientConfig succeeds during onBeforeBuild and mutates staging', async () => {
    let checkedIsFrozenInHook = null

    const routerPlugin = definePlugin({
      name: 'router',
      client: {
        config: {
          prefetch: {
            type: Boolean,
            default: true
          },
          routes: {
            type: Array,
            default: []
          }
        }
      },
      server: {
        onBeforeBuild ({ config }) {
          checkedIsFrozenInHook = Object.isFrozen(config.clientConfig)
          config.clientConfig.routes = ['/home', '/about']
        }
      }
    })

    const configuredPlugin = routerPlugin()
    const app = createMockApp([configuredPlugin])
    const serverGlobalContext = {}
    const rawHooksObj = createEmptyHooksObj()
    const hooksManager = createHooksHelper(app, serverGlobalContext, rawHooksObj)

    const scriptManager = {
      use: () => {
      },
      compileComponents: async () => ({
        outputFiles: {},
        manifest: {}
      }),
      sharedFunctions: {},
      scriptModules: []
    }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: rawHooksObj
      },
      scriptManager,
      source: { plugins: {} }
    })

    // Before build hooks fire: client.config is NOT frozen
    assert.strictEqual(Object.isFrozen(configuredPlugin.client.config), false)

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError: () => {
      },
      hooks: hooksManager,
      options: app.options,
      createExecutionError: (err) => err
    })

    await renderer.build()

    // Inside hook, client.config was NOT frozen
    assert.strictEqual(checkedIsFrozenInHook, false)

    // After build hooks complete, client.config IS frozen
    assert.strictEqual(Object.isFrozen(configuredPlugin.client.config), true)

    // Values written during build hook are present and default was applied
    assert.deepEqual(configuredPlugin.client.config.routes, ['/home', '/about'])
    assert.strictEqual(configuredPlugin.client.config.prefetch, true)
  })

  it('writing an undeclared key to config.clientConfig throws CORALITE-P207', async () => {
    const testPlugin = definePlugin({
      name: 'test-plugin',
      client: {
        config: {
          allowedKey: {
            type: String,
            default: 'ok'
          }
        }
      },
      server: {
        onBeforeBuild ({ config }) {
          config.clientConfig.unknownKey = 'fail'
        }
      }
    })

    const configuredPlugin = testPlugin()
    const app = createMockApp([configuredPlugin])
    const serverGlobalContext = {}
    const rawHooksObj = createEmptyHooksObj()
    const hooksManager = createHooksHelper(app, serverGlobalContext, rawHooksObj)

    const scriptManager = {
      use: () => {
      },
      compileComponents: async () => ({
        outputFiles: {},
        manifest: {}
      }),
      sharedFunctions: {},
      scriptModules: []
    }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: rawHooksObj
      },
      scriptManager,
      source: { plugins: {} }
    })

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError: () => {
      },
      hooks: hooksManager,
      options: app.options,
      createExecutionError: (err) => err
    })

    await assert.rejects(
      async () => {
        await renderer.build()
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P207')
        return true
      }
    )
  })

  it('writing directly to config.<key> throws CORALITE-P209', async () => {
    const testPlugin = definePlugin({
      name: 'test-plugin',
      server: {
        config: {
          serverVal: {
            type: String,
            default: 'initial'
          }
        },
        onBeforeBuild ({ config }) {
          config.serverVal = 'mutated'
        }
      }
    })

    const configuredPlugin = testPlugin()
    const app = createMockApp([configuredPlugin])
    const serverGlobalContext = {}
    const rawHooksObj = createEmptyHooksObj()
    const hooksManager = createHooksHelper(app, serverGlobalContext, rawHooksObj)

    const scriptManager = {
      use: () => {
      },
      compileComponents: async () => ({
        outputFiles: {},
        manifest: {}
      }),
      sharedFunctions: {},
      scriptModules: []
    }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: rawHooksObj
      },
      scriptManager,
      source: { plugins: {} }
    })

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError: () => {
      },
      hooks: hooksManager,
      options: app.options,
      createExecutionError: (err) => err
    })

    await assert.rejects(
      async () => {
        await renderer.build()
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P209')
        return true
      }
    )
  })

  it('server.config remains frozen throughout registration, hook execution, and build completion', async () => {
    let serverConfigFrozenDuringHook = null

    const testPlugin = definePlugin({
      name: 'test-plugin',
      server: {
        config: {
          title: {
            type: String,
            default: 'Site'
          }
        },
        onBeforeBuild ({ config }) {
          serverConfigFrozenDuringHook = Object.isFrozen(config)
        }
      }
    })

    const configuredPlugin = testPlugin()
    const app = createMockApp([configuredPlugin])
    const serverGlobalContext = {}
    const rawHooksObj = createEmptyHooksObj()
    const hooksManager = createHooksHelper(app, serverGlobalContext, rawHooksObj)

    const scriptManager = {
      use: () => {
      },
      compileComponents: async () => ({
        outputFiles: {},
        manifest: {}
      }),
      sharedFunctions: {},
      scriptModules: []
    }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: rawHooksObj
      },
      scriptManager,
      source: { plugins: {} }
    })

    // Frozen at registration
    assert.strictEqual(Object.isFrozen(configuredPlugin.server.config), true)

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError: () => {
      },
      hooks: hooksManager,
      options: app.options,
      createExecutionError: (err) => err
    })

    await renderer.build()

    // Frozen during hook
    assert.strictEqual(serverConfigFrozenDuringHook, true)

    // Frozen after build
    assert.strictEqual(Object.isFrozen(configuredPlugin.server.config), true)
  })

  it('existing plugins without late-bound writes behave identically and freeze post-build', async () => {
    const simplePlugin = definePlugin({
      name: 'simple',
      client: {
        config: {
          version: {
            type: String,
            default: '1.0'
          }
        }
      }
    })

    const configuredPlugin = simplePlugin()
    const app = createMockApp([configuredPlugin])
    const serverGlobalContext = {}
    const rawHooksObj = createEmptyHooksObj()
    const hooksManager = createHooksHelper(app, serverGlobalContext, rawHooksObj)

    const scriptManager = {
      use: () => {
      },
      compileComponents: async () => ({
        outputFiles: {},
        manifest: {}
      }),
      sharedFunctions: {},
      scriptModules: []
    }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: rawHooksObj
      },
      scriptManager,
      source: { plugins: {} }
    })

    assert.strictEqual(configuredPlugin.client.config.version, '1.0')
    assert.strictEqual(Object.isFrozen(configuredPlugin.client.config), false)

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError: () => {
      },
      hooks: hooksManager,
      options: app.options,
      createExecutionError: (err) => err
    })

    await renderer.build()

    assert.strictEqual(configuredPlugin.client.config.version, '1.0')
    assert.strictEqual(Object.isFrozen(configuredPlugin.client.config), true)
  })
})
