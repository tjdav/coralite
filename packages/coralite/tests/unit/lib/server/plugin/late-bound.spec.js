import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'
import { setupPlugins } from '../../../../../lib/server/plugin/setup.js'
import { createRenderer } from '../../../../../lib/server/renderer.js'
import { initHasher } from '../../../../../lib/server/utils/manifest.js'

describe('late-bound plugin config values', () => {
  it('setup hasher', async () => {
    await initHasher()
  })

  it('allows writing declared late-bound keys to clientConfig staging during onBeforeBuild', async () => {
    const routerPlugin = definePlugin({
      name: 'router',
      client: {
        config: {
          prefetch: { type: Boolean, default: true },
          routes: { type: Array, default: [] }
        }
      },
      server: {
        async onBeforeBuild ({ config }) {
          config.clientConfig.routes = ['/about', '/contact']
        }
      }
    })

    const instantiatedPlugin = routerPlugin()
    const app = {
      options: {
        plugins: [instantiatedPlugin],
        mode: 'development',
        baseURL: '/',
        path: { pages: '/tmp', components: '/tmp' }
      },
      pages: { list: [], getItem: () => null },
      components: { list: [], getItem: () => null },
      _dependencyGraph: { pageCustomElements: {}, directPageComponents: {} },
      _refreshDependencyGraph () {}
    }

    const serverGlobalContext = {}
    const hooks = {
      onBeforeBuild: [],
      trigger: async (name, data) => {
        if (name === 'onBeforeBuild') {
          for (const fn of hooks.onBeforeBuild) {
            await fn(data)
          }
        }
        return data
      }
    }

    const scriptManager = { use () {}, compileComponents: async () => ({ manifest: {}, outputFiles: {} }), scriptModules: [] }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: { components: [], hooks },
      scriptManager,
      source: { plugins: {} }
    })

    // During build before post-hook freeze: client.config is NOT frozen
    assert.strictEqual(Object.isFrozen(instantiatedPlugin.client.config), false)

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError () {},
      hooks,
      options: app.options,
      createExecutionError: (err) => err
    })

    await renderer.build()

    // After build: client.config is frozen and updated
    assert.strictEqual(Object.isFrozen(instantiatedPlugin.client.config), true)
    assert.deepStrictEqual(instantiatedPlugin.client.config.routes, ['/about', '/contact'])
    assert.strictEqual(instantiatedPlugin.client.config.prefetch, true)
  })

  it('throws CORALITE-P207 when writing to an undeclared key in clientConfig staging', async () => {
    const plugin = definePlugin({
      name: 'router',
      client: {
        config: {
          routes: { type: Array, default: [] }
        }
      },
      server: {
        async onBeforeBuild ({ config }) {
          config.clientConfig.undeclaredKey = 'test'
        }
      }
    })

    const instantiatedPlugin = plugin()
    const app = {
      options: {
        plugins: [instantiatedPlugin],
        mode: 'development',
        baseURL: '/',
        path: { pages: '/tmp', components: '/tmp' }
      },
      pages: { list: [], getItem: () => null },
      components: { list: [], getItem: () => null },
      _dependencyGraph: { pageCustomElements: {}, directPageComponents: {} },
      _refreshDependencyGraph () {}
    }

    const serverGlobalContext = {}
    const hooks = {
      onBeforeBuild: [],
      trigger: async (name, data) => {
        if (name === 'onBeforeBuild') {
          for (const fn of hooks.onBeforeBuild) {
            await fn(data)
          }
        }
        return data
      }
    }

    const scriptManager = { use () {}, compileComponents: async () => ({ manifest: {}, outputFiles: {} }), scriptModules: [] }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: { components: [], hooks },
      scriptManager,
      source: { plugins: {} }
    })

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError () {},
      hooks,
      options: app.options,
      createExecutionError: (err) => err
    })

    await assert.rejects(
      async () => {
        await renderer.build()
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P207')
        assert.match(err.message, /undeclaredKey/)
        return true
      }
    )
  })

  it('throws CORALITE-P208 when writing to server.config without lateBound: true', async () => {
    const plugin = definePlugin({
      name: 'seo',
      server: {
        config: {
          sitemap: { type: Array, default: [] }
        },
        async onBeforeBuild ({ config }) {
          config.sitemap = ['/page1']
        }
      }
    })

    const instantiatedPlugin = plugin()
    const app = {
      options: {
        plugins: [instantiatedPlugin],
        mode: 'development',
        baseURL: '/',
        path: { pages: '/tmp', components: '/tmp' }
      },
      pages: { list: [], getItem: () => null },
      components: { list: [], getItem: () => null },
      _dependencyGraph: { pageCustomElements: {}, directPageComponents: {} },
      _refreshDependencyGraph () {}
    }

    const serverGlobalContext = {}
    const hooks = {
      onBeforeBuild: [],
      trigger: async (name, data) => {
        if (name === 'onBeforeBuild') {
          for (const fn of hooks.onBeforeBuild) {
            await fn(data)
          }
        }
        return data
      }
    }

    const scriptManager = { use () {}, compileComponents: async () => ({ manifest: {}, outputFiles: {} }), scriptModules: [] }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: { components: [], hooks },
      scriptManager,
      source: { plugins: {} }
    })

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError () {},
      hooks,
      options: app.options,
      createExecutionError: (err) => err
    })

    await assert.rejects(
      async () => {
        await renderer.build()
      },
      (err) => {
        assert.strictEqual(err.code, 'CORALITE-P208')
        assert.match(err.message, /sitemap/)
        return true
      }
    )
  })

  it('succeeds when writing to server.config key declared with lateBound: true', async () => {
    const plugin = definePlugin({
      name: 'seo',
      server: {
        config: {
          sitemap: { type: Array, default: [], lateBound: true }
        },
        async onBeforeBuild ({ config }) {
          config.sitemap = ['/page1', '/page2']
        }
      }
    })

    const instantiatedPlugin = plugin()
    const app = {
      options: {
        plugins: [instantiatedPlugin],
        mode: 'development',
        baseURL: '/',
        path: { pages: '/tmp', components: '/tmp' }
      },
      pages: { list: [], getItem: () => null },
      components: { list: [], getItem: () => null },
      _dependencyGraph: { pageCustomElements: {}, directPageComponents: {} },
      _refreshDependencyGraph () {}
    }

    const serverGlobalContext = {}
    const hooks = {
      onBeforeBuild: [],
      trigger: async (name, data) => {
        if (name === 'onBeforeBuild') {
          for (const fn of hooks.onBeforeBuild) {
            await fn(data)
          }
        }
        return data
      }
    }

    const scriptManager = { use () {}, compileComponents: async () => ({ manifest: {}, outputFiles: {} }), scriptModules: [] }

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: { components: [], hooks },
      scriptManager,
      source: { plugins: {} }
    })

    const renderer = createRenderer({
      app,
      scriptManager,
      source: { plugins: {} },
      evaluate: async () => ({}),
      handleError () {},
      hooks,
      options: app.options,
      createExecutionError: (err) => err
    })

    await renderer.build()

    assert.strictEqual(Object.isFrozen(instantiatedPlugin.server.config), true)
    assert.deepStrictEqual(instantiatedPlugin.server.config.sitemap, ['/page1', '/page2'])
  })
})
