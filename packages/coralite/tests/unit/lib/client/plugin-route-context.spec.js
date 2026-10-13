/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { ScriptManager } from '#lib/server/script-manager.js'
import { definePlugin } from '#lib/server/plugin/define.js'
import { createCoraliteClass } from '#lib/client/element.js'
import { routeAwarePlugin } from '../../../fixtures/plugins/route-aware-plugin.js'
import { createCoralite } from '#lib/index.js'

async function importCompiledRuntime (scriptManager) {
  const { outputFiles } = await scriptManager.compileComponents('development')
  const runtimeFile = Object.values(outputFiles).find(f => f.path.includes('coralite-runtime'))
  assert.ok(runtimeFile, 'coralite-runtime output file must exist')

  const b64 = Buffer.from(runtimeFile.text).toString('base64')
  return import(`data:text/javascript;base64,${b64}#${Math.random().toString(36).substring(2)}`)
}

describe('Plugin Route Context (client.init and client.context Phase 1)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete window.__coralite_hydration__
    delete window.__coralite__
    delete window.__route_aware_plugin_init_route
    delete window.__p1_init_route
    delete window.__p2_init_route
    delete window.__p1_phase1_route
    delete window.__p2_phase1_route
    delete window.__aligned_init_route
    delete window.__aligned_phase1_route
  })

  it('client.init receives route with correct shape for a static page', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/about.html',
        pattern: '/about.html',
        params: {},
        dynamic: false
      }
    }

    const scriptManager = new ScriptManager()
    await scriptManager.use(routeAwarePlugin())

    try {
      const mod = await importCompiledRuntime(scriptManager)
      await mod.initPlugins()

      const initRoute = window.__route_aware_plugin_init_route
      assert.ok(initRoute, 'client.init should receive route from window.__coralite_hydration__.__route__')
      assert.equal(initRoute.path, '/about.html')
      assert.equal(initRoute.pattern, '/about.html')
      assert.deepEqual(initRoute.params, {})
      assert.equal(initRoute.dynamic, false)
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('client.init receives route with correct shape for a dynamic page', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/users/99.html',
        pattern: '/users/[id].html',
        params: { id: '99' },
        dynamic: true
      }
    }

    const scriptManager = new ScriptManager()
    await scriptManager.use(routeAwarePlugin())

    try {
      const mod = await importCompiledRuntime(scriptManager)
      await mod.initPlugins()

      const initRoute = window.__route_aware_plugin_init_route
      assert.ok(initRoute)
      assert.equal(initRoute.path, '/users/99.html')
      assert.equal(initRoute.pattern, '/users/[id].html')
      assert.equal(initRoute.params.id, '99')
      assert.equal(initRoute.dynamic, true)
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('client.context Phase 1 receives route matching the page route', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/dashboard.html',
        pattern: '/dashboard.html',
        params: {},
        dynamic: false
      }
    }

    const scriptManager = new ScriptManager()
    await scriptManager.use(routeAwarePlugin())

    try {
      const mod = await importCompiledRuntime(scriptManager)

      const instanceContext = {
        id: 'comp-1',
        route: window.__coralite_hydration__.__route__
      }

      const resolvedContext = await mod.getClientContext(instanceContext)
      const pluginRoute = resolvedContext.routeAware.getPluginRoute()
      const instanceRoute = resolvedContext.routeAware.getInstanceRoute()

      assert.ok(pluginRoute)
      assert.equal(pluginRoute.path, '/dashboard.html')
      assert.ok(instanceRoute)
      assert.equal(instanceRoute.path, '/dashboard.html')
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('client.context Phase 2 can read route from instanceContext (regression check)', async () => {
    window.__coralite_hydration__ = {
      __route__: {
        path: '/items/42.html',
        pattern: '/items/[id].html',
        params: { id: '42' },
        dynamic: true
      }
    }

    const scriptManager = new ScriptManager()
    await scriptManager.use(routeAwarePlugin())

    try {
      const mod = await importCompiledRuntime(scriptManager)

      const instanceContext = {
        id: 'comp-2',
        route: window.__coralite_hydration__.__route__
      }

      const resolvedContext = await mod.getClientContext(instanceContext)
      const instanceRoute = resolvedContext.routeAware.getInstanceRoute()

      assert.ok(instanceRoute)
      assert.equal(instanceRoute.path, '/items/42.html')
      assert.equal(instanceRoute.params.id, '42')
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('when window.__coralite_hydration__.__route__ is absent, route is undefined in both plugin contexts', async () => {
    window.__coralite_hydration__ = {}

    const scriptManager = new ScriptManager()
    await scriptManager.use(routeAwarePlugin())

    try {
      const mod = await importCompiledRuntime(scriptManager)
      await mod.initPlugins()

      const initRoute = window.__route_aware_plugin_init_route

      const instanceContext = { id: 'comp-no-route' }
      const resolvedContext = await mod.getClientContext(instanceContext)
      const pluginRoute = resolvedContext.routeAware.getPluginRoute()

      assert.strictEqual(initRoute, undefined)
      assert.strictEqual(pluginRoute, undefined)
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('multiple plugins receive the same route object', async () => {
    const pageRoute = {
      path: '/shared-route.html',
      pattern: '/shared-route.html',
      params: {},
      dynamic: false
    }
    window.__coralite_hydration__ = { __route__: pageRoute }

    const plugin1 = definePlugin({
      name: 'p1',
      client: {
        init ({ route }) {
          window.__p1_init_route = route
        },
        context: (pluginContext) => {
          window.__p1_phase1_route = pluginContext.route
          return () => ({})
        }
      }
    })

    const plugin2 = definePlugin({
      name: 'p2',
      client: {
        init ({ route }) {
          window.__p2_init_route = route
        },
        context: (pluginContext) => {
          window.__p2_phase1_route = pluginContext.route
          return () => ({})
        }
      }
    })

    const scriptManager = new ScriptManager()
    await scriptManager.use(plugin1())
    await scriptManager.use(plugin2())

    try {
      const mod = await importCompiledRuntime(scriptManager)
      await mod.initPlugins()
      await mod.getClientContext({ id: 'comp-shared' })

      assert.strictEqual(window.__p1_init_route, pageRoute)
      assert.strictEqual(window.__p2_init_route, pageRoute)
      assert.strictEqual(window.__p1_phase1_route, pageRoute)
      assert.strictEqual(window.__p2_phase1_route, pageRoute)
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('the route read by plugins matches the route read by component blocks on the same page', async () => {
    const pageRoute = {
      path: '/aligned-route/123.html',
      pattern: '/aligned-route/[id].html',
      params: { id: '123' },
      dynamic: true
    }
    window.__coralite_hydration__ = { __route__: pageRoute }

    let componentClientRoute = null

    const plugin = definePlugin({
      name: 'aligned-plugin',
      client: {
        init ({ route }) {
          window.__aligned_init_route = route
        },
        context: (pluginContext) => {
          window.__aligned_phase1_route = pluginContext.route
          return () => ({})
        }
      }
    })

    const scriptManager = new ScriptManager()
    await scriptManager.use(plugin())

    try {
      const mod = await importCompiledRuntime(scriptManager)
      await mod.initPlugins()

      const tag = 'aligned-comp-' + Math.random().toString(36).substring(2, 9)
      const CompClass = createCoraliteClass({
        componentId: 'aligned-comp',
        client: ({ route }) => {
          componentClientRoute = route
        }
      }, mod.getClientContext)

      customElements.define(tag, CompClass)
      const el = document.createElement(tag)
      document.body.appendChild(el)

      await new Promise(resolve => setTimeout(resolve, 10))

      assert.strictEqual(window.__aligned_init_route, pageRoute)
      assert.strictEqual(window.__aligned_phase1_route, pageRoute)
      assert.strictEqual(componentClientRoute, pageRoute)
    } finally {
      await scriptManager.disposeContext()
    }
  })

  it('plugin-route-host.html fixture page builds and serialized route is accessible by routeAwarePlugin', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'coralite-plugin-route-test-'))
    const pagesDir = join(tempDir, 'pages')
    const compsDir = join(tempDir, 'components')
    const outDir = join(tempDir, 'dist')

    await mkdir(pagesDir, { recursive: true })
    await mkdir(compsDir, { recursive: true })

    const fixturePath = fileURLToPath(new URL('../../../fixtures/pages/plugin-route-host/[id].html', import.meta.url))
    const hostHtml = await readFile(fixturePath, 'utf8')
    await writeFile(join(pagesDir, '[id].html'), hostHtml)

    try {
      const coralite = await createCoralite({
        components: compsDir,
        pages: pagesDir,
        output: outDir,
        plugins: [routeAwarePlugin],
        mode: 'testing'
      })

      const results = await coralite.build()
      const hostResult = results.find(r => r.path?.pathname?.includes('42.html') || r.path?.pathname?.includes('99.html'))
      assert.ok(hostResult, 'plugin-route-host page result must exist')
      assert.ok(hostResult.content.includes('Plugin Route Host Page'), 'HTML content should render successfully')
    } finally {
      await rm(tempDir, {
        recursive: true,
        force: true
      })
    }
  })
})
