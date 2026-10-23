import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin from '../../../plugins/router.js'

describe('Router Plugin ViewTransitions Config Unit Tests', () => {
  let mockDom
  let mockOutlet
  let mockRuntime
  let mockHistory
  let mockWindow

  beforeEach(() => {
    mockOutlet = {
      tagName: 'ROUTER-OUTLET',
      childNodes: [],
      listeners: {},
      addEventListener (type, fn) {
        this.listeners[type] = fn
      },
      replaceChildren (...nodes) {
        this.childNodes = nodes
      }
    }

    mockHistory = {
      pushed: [],
      replaced: [],
      pushState (state, title, url) {
        this.pushed.push({
          state,
          title,
          url
        })
      },
      replaceState (state, title, url) {
        this.replaced.push({
          state,
          title,
          url
        })
      }
    }

    mockRuntime = {
      hydrationStore: {
        replace () {
        }
      },
      async upgrade () {
      }
    }

    mockDom = {
      title: 'Test',
      head: {
        querySelectorAll () {
          return []
        },
        querySelector () {
          return null
        },
        appendChild () {
        }
      },
      querySelector (sel) {
        if (sel === '[data-router-outlet], router-outlet') {
          return mockOutlet
        }
        return null
      }
    }

    mockWindow = {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: ''
      },
      history: mockHistory,
      listeners: {},
      addEventListener (type, fn) {
        this.listeners[type] = fn
      },
      scrollTo () {
      }
    }

    globalThis.window = mockWindow
    globalThis.document = mockDom
    globalThis.history = mockHistory
    globalThis.location = mockWindow.location
  })

  it('router reads viewTransitions: true from payload', () => {
    mockWindow.__coralite_hydration__ = {
      __route__: {
        path: '/',
        pattern: '/',
        params: {},
        dynamic: false
      },
      viewTransitions: true
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    assert.strictEqual(mockWindow.__coralite_router__.viewTransitions, true)
  })

  it('router reads viewTransitions: false from payload', () => {
    mockWindow.__coralite_hydration__ = {
      __route__: {
        path: '/',
        pattern: '/',
        params: {},
        dynamic: false
      },
      viewTransitions: false
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    assert.strictEqual(mockWindow.__coralite_router__.viewTransitions, false)
  })
})
