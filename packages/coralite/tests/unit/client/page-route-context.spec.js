import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { setupPageRuntime } from '../../../lib/client/element.js'

describe('Client-side Route Context in Page Blocks', () => {
  let window
  let document

  beforeEach(() => {
    window = new Window({ url: 'http://localhost' })
    document = window.document
    global.window = window
    global.document = document
    global.Event = window.Event
    global.HTMLElement = window.HTMLElement
    global.CustomEvent = window.CustomEvent
    global.MutationObserver = window.MutationObserver
    global.Node = window.Node
    global.customElements = window.customElements
  })

  afterEach(() => {
    delete global.window
    delete global.document
    delete global.Event
    delete global.HTMLElement
    delete global.CustomEvent
    delete global.MutationObserver
    delete global.Node
    delete global.customElements
  })

  it('page client receives route read from window.__coralite_hydration__.__route__ for a static page', async () => {
    document.documentElement.innerHTML = '<head></head><body><h1>Client Test</h1></body>'
    document.documentElement.removeAttribute('data-route-path')
    document.documentElement.removeAttribute('data-route-dynamic')

    window.__coralite_hydration__ = {
      __route__: {
        path: '/about.html',
        pattern: '/about.html',
        params: {},
        dynamic: false
      }
    }

    let clientRoute = null

    const pageConfig = {
      client: ({ route }) => {
        clientRoute = route
        document.documentElement.dataset.routePath = route.path
        document.documentElement.dataset.routeDynamic = String(route.dynamic)
      }
    }

    await setupPageRuntime(pageConfig)

    assert.ok(clientRoute, 'Page client context should receive route')
    assert.equal(clientRoute.path, '/about.html')
    assert.equal(clientRoute.pattern, '/about.html')
    assert.equal(clientRoute.dynamic, false)
    assert.deepEqual(clientRoute.params, {})
    assert.equal(document.documentElement.dataset.routePath, '/about.html')
    assert.equal(document.documentElement.dataset.routeDynamic, 'false')
  })

  it('page client receives route read from window.__coralite_hydration__.__route__ for a dynamic page', async () => {
    document.documentElement.innerHTML = '<head></head><body><h1>Post Test</h1></body>'

    window.__coralite_hydration__ = {
      __route__: {
        path: '/posts/42.html',
        pattern: '/posts/[id].html',
        params: { id: '42' },
        dynamic: true
      }
    }

    let clientRoute = null

    const pageConfig = {
      client: ({ route }) => {
        clientRoute = route
        document.documentElement.dataset.routePath = route.path
        document.documentElement.dataset.postId = route.params.id
      }
    }

    await setupPageRuntime(pageConfig)

    assert.ok(clientRoute)
    assert.equal(clientRoute.path, '/posts/42.html')
    assert.equal(clientRoute.pattern, '/posts/[id].html')
    assert.equal(clientRoute.params.id, '42')
    assert.equal(clientRoute.dynamic, true)
    assert.equal(document.documentElement.dataset.routePath, '/posts/42.html')
    assert.equal(document.documentElement.dataset.postId, '42')
  })

  it('page getters on client receives route read from window.__coralite_hydration__.__route__', async () => {
    document.documentElement.innerHTML = '<head></head><body><h1 id="title">{{ greeting }}</h1></body>'

    window.__coralite_hydration__ = {
      __route__: {
        path: '/dashboard.html',
        pattern: '/dashboard.html',
        params: {},
        dynamic: false
      }
    }

    let getterRoute = null

    const pageConfig = {
      state: { name: 'Bob' },
      getters: {
        greeting: ({ state, route }) => {
          getterRoute = route
          return `Hello ${state.name} at ${route.path}`
        }
      }
    }

    await setupPageRuntime(pageConfig)

    assert.ok(getterRoute)
    assert.equal(getterRoute.path, '/dashboard.html')
    assert.equal(document.documentElement.querySelector('#title').textContent, 'Hello Bob at /dashboard.html')
  })
})
