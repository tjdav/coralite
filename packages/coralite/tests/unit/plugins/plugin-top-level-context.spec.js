
import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { definePlugin } from '#lib'
import { setupPlugins } from '../../../lib/server/plugin-setup.js'
import { setupPageRuntime } from '#lib/client/page-runtime.js'
import { createCoraliteClass } from '../../../lib/client/element.js'
import { createComponentDefinition } from '../../../lib/server/component-setup.js'

describe('top-level plugin context', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    /** @type {any} */
    const win = window
    delete win.__coralite__
  })

  it('validates context must be a function', () => {
    assert.throws(
      () => definePlugin({
        name: 'invalid-context-plugin',
        /** @type {any} */
        context: 'not-a-function'
      }),
      /Coralite plugin validation failed: "context" must be a function/
    )
  })

  it('enforces mutual exclusivity with server.context (CORALITE-P211)', () => {
    assert.throws(
      () => definePlugin({
        name: 'conflict-server-plugin',
        context: () => () => ({}),
        server: {
          context: () => () => ({})
        }
      }),
      /CORALITE-P211/
    )
  })

  it('enforces mutual exclusivity with client.context (CORALITE-P211)', () => {
    assert.throws(
      () => definePlugin({
        name: 'conflict-client-plugin',
        context: () => () => ({}),
        client: {
          context: () => () => ({})
        }
      }),
      /CORALITE-P211/
    )
  })

  it('registers top-level context during setupPlugins', async () => {
    let phase1Context = null
    const plugin = definePlugin({
      name: '$t',
      config: {
        defaultLocale: {
          type: String,
          default: 'en'
        }
      },
      context: (initCtx) => {
        phase1Context = initCtx
        return (_instanceCtx) => ({
          translate: (key) => `[${initCtx.config.defaultLocale}]: ${key}`
        })
      }
    })

    const app = { options: { plugins: [plugin] } }
    const serverGlobalContext = {}
    const source = { plugins: {} }
    const scriptCalls = []

    await setupPlugins({
      app,
      serverGlobalContext,
      plugins: {
        components: [],
        hooks: {}
      },
      scriptManager: {
        use: (plug) => {
          scriptCalls.push(plug)
        }
      },
      source
    })

    assert.ok(phase1Context, 'phase 1 was called')
    assert.strictEqual(phase1Context.config.defaultLocale, 'en')
    assert.ok(source.plugins.$t, 'registered into source.plugins')
    assert.ok(source.isomorphicPlugins.$t, 'registered into source.isomorphicPlugins')
    assert.ok(serverGlobalContext.$t, 'registered into serverGlobalContext')
    assert.strictEqual(scriptCalls.length, 1)

    const instanceResult = source.isomorphicPlugins.$t({ route: { path: '/' } })
    assert.strictEqual(instanceResult.translate('hello'), '[en]: hello')
  })

  it('provides top-level context to page getters and client runtime in browser', async () => {
    /** @type {any} */
    const win = window
    win.__coralite__ = {
      plugins: {
        isomorphic: {
          $t: (_instanceCtx) => (key) => `translated:${key}`
        }
      }
    }

    let getterResult = null
    let clientCtx = null

    await setupPageRuntime({
      getters: {
        heading ({ $t }) {
          getterResult = $t('welcome')
          return getterResult
        }
      },
      client (ctx) {
        clientCtx = ctx
        const evaluatedHeading = ctx.state.heading
        assert.strictEqual(evaluatedHeading, 'translated:welcome')
      }
    })

    assert.strictEqual(getterResult, 'translated:welcome')
    assert.ok(clientCtx)
    assert.strictEqual(typeof clientCtx.$t, 'function')
    assert.strictEqual(clientCtx.$t('hello'), 'translated:hello')
  })

  it('provides top-level context to component getters in browser', () => {
    const tagName = 'iso-comp-' + Math.random().toString(36).substring(2, 9)
    /** @type {any} */
    const win = window
    win.__coralite__ = {
      plugins: {
        isomorphic: {
          $t: () => (key) => `localized:${key}`
        }
      }
    }

    const IsoElement = createCoraliteClass({
      componentId: 'iso-comp',
      templateHTML: '<div><span id="text">{{ greeting }}</span></div>',
      getters: {
        greeting ({ $t }) {
          return $t('hello_world')
        }
      },
      hydrationMap: {
        texts: [{
          path: [0, 0],
          template: '{{ greeting }}'
        }]
      }
    })
    customElements.define(tagName, IsoElement)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.strictEqual(el.querySelector('#text').textContent, 'localized:hello_world')
    document.body.removeChild(el)
  })

  it('exposes top-level context keys to page getters via Object.keys and spread', async () => {
    /** @type {any} */
    const win = window
    win.__coralite__ = {
      plugins: {
        isomorphic: {
          $t: () => (key) => `translated:${key}`
        }
      }
    }

    let hasKey = null
    let spreadResult = null

    await setupPageRuntime({
      getters: {
        probe (ctx) {
          hasKey = Object.keys(ctx).includes('$t')
          spreadResult = { ...ctx }.$t('spread')
          return spreadResult
        }
      },
      client ({ state }) {
        assert.strictEqual(state.probe, 'translated:spread')
      }
    })

    assert.strictEqual(hasKey, true)
    assert.strictEqual(spreadResult, 'translated:spread')
  })

  it('exposes top-level context keys to component getters via Object.keys and spread', () => {
    const tagName = 'iso-spread-' + Math.random().toString(36).substring(2, 9)
    /** @type {any} */
    const win = window
    win.__coralite__ = {
      plugins: {
        isomorphic: {
          $t: () => (key) => `localized:${key}`
        }
      }
    }

    let hasKey = null

    const IsoElement = createCoraliteClass({
      componentId: 'iso-spread',
      templateHTML: '<div><span id="text">{{ greeting }}</span></div>',
      getters: {
        greeting (ctx) {
          hasKey = Object.keys(ctx).includes('$t')
          return { ...ctx }.$t('spread')
        }
      },
      hydrationMap: {
        texts: [{
          path: [0, 0],
          template: '{{ greeting }}'
        }]
      }
    })
    customElements.define(tagName, IsoElement)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.strictEqual(hasKey, true)
    assert.strictEqual(el.querySelector('#text').textContent, 'localized:spread')
    document.body.removeChild(el)
  })

  it('provides top-level context to component SSR getters and server()', async () => {
    const plugin = definePlugin({
      name: '$t',
      context: () => () => ({
        translate: (key) => `ssr:[${key}]`
      })
    })

    const app = {
      options: { plugins: [plugin] },
      source: {
        plugins: {},
        isomorphicPlugins: {}
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
        use: () => {
        }
      },
      source: app.source
    })

    const defineComp = createComponentDefinition({ app })
    const module = {
      id: 'test-ssr',
      path: { pathname: '/test-ssr.html' }
    }
    let serverReceivedT = null

    const componentState = await defineComp({
      server ({ $t }) {
        serverReceivedT = $t
        return { fromServer: $t.translate('server_key') }
      },
      getters: {
        derived ({ $t, state }) {
          return `${state.fromServer} + ${$t.translate('getter_key')}`
        }
      }
    }, {
      state: {},
      module,
      root: null,
      source: app.source,
      app
    })

    assert.ok(serverReceivedT, 'server() received $t')
    assert.strictEqual(componentState.fromServer, 'ssr:[server_key]')
    assert.strictEqual(componentState.derived, 'ssr:[server_key] + ssr:[getter_key]')
  })
})
