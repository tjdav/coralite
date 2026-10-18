
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin from '../../../plugins/router.js'

describe('Router Plugin Navigation Guards Unit Tests', () => {
  let mockDom
  let mockOutlet
  let mockRuntime
  let mockHistory
  let mockWindow
  let fetchCalls
  let replacedLocations
  let loggedErrors

  beforeEach(() => {
    fetchCalls = []
    replacedLocations = []
    loggedErrors = []

    mockOutlet = {
      tagName: 'ROUTER-OUTLET',
      childNodes: ['old-child'],
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
        if (mockWindow.location) {
          mockWindow.location.pathname = url
        }
      },
      replaceState (state, title, url) {
        this.replaced.push({
          state,
          title,
          url
        })
        if (mockWindow.location) {
          mockWindow.location.pathname = url
        }
      }
    }

    mockRuntime = {
      hydrationStore: {
        replaced: null,
        replace (data) {
          this.replaced = data
        }
      },
      upgraded: [],
      async upgrade (el) {
        this.upgraded.push(el)
      }
    }

    const elementsBySelector = {
      '[data-router-outlet], router-outlet': mockOutlet,
      title: {
        textContent: 'Old Title'
      }
    }

    mockDom = {
      title: 'Old Title',
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
        return elementsBySelector[sel] || null
      }
    }

    mockWindow = {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: '',
        replace (url) {
          replacedLocations.push(url)
        }
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
    globalThis.fetch = async (url, opts) => {
      fetchCalls.push({
        url,
        opts
      })
      return {
        ok: true,
        status: 200,
        text: async () => `<router-outlet><h1>Page for ${url}</h1></router-outlet>`
      }
    }
    globalThis.DOMParser = class {
      parseFromString () {
        return {
          querySelector (sel) {
            if (sel === '[data-router-outlet], router-outlet') {
              return {
                childNodes: ['new-node']
              }
            }
            return null
          },
          head: {
            querySelectorAll () {
              return []
            }
          }
        }
      }
    }

    // Intercept console.error for testing error logs
    const origConsoleError = console.error
    console.error = (...args) => {
      loggedErrors.push(args)
    }

    return () => {
      console.error = origConsoleError
    }
  })

  it('beforeEach returns a dispose function that unregisters the guard', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__
    let guardCalled = false

    const dispose = router.beforeEach(() => {
      guardCalled = true
    })

    assert.strictEqual(typeof dispose, 'function')

    await router.navigate('/about')
    assert.strictEqual(guardCalled, true)

    guardCalled = false
    dispose()

    await router.navigate('/about')
    assert.strictEqual(guardCalled, false)
  })

  it('allows navigation when guard returns undefined or true', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__
    let guard1Called = false
    let guard2Called = false

    router.beforeEach(({ to, from, signal }) => {
      guard1Called = true
      assert.strictEqual(to.path, '/about')
      assert.strictEqual(from.path, '/')
      assert.ok(signal)
      return undefined
    })

    router.beforeEach(({ to, from }) => {
      guard2Called = true
      assert.strictEqual(to.path, '/about')
      assert.strictEqual(from.path, '/')
      return true
    })

    await router.navigate('/about')

    assert.strictEqual(guard1Called, true)
    assert.strictEqual(guard2Called, true)
    assert.strictEqual(fetchCalls.length, 1)
    assert.strictEqual(fetchCalls[0].url, '/about')
    assert.strictEqual(mockHistory.pushed.length, 1)
    assert.strictEqual(mockHistory.pushed[0].url, '/about')
  })

  it('cancels navigation when guard returns false (no fetch, no URL update)', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__

    router.beforeEach(({ to }) => {
      if (to.path === '/admin') {
        return false
      }
    })

    await router.navigate('/admin')

    assert.strictEqual(fetchCalls.length, 0, 'No fetch performed')
    assert.strictEqual(mockHistory.pushed.length, 0, 'History pushState not called')
    assert.strictEqual(mockHistory.replaced.length, 0, 'History replaceState not called')
    assert.strictEqual(mockWindow.location.pathname, '/', 'URL remained unchanged')
  })

  it('redirects via navigate with replace: true when guard returns absolute string path', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__

    router.beforeEach(({ to }) => {
      if (to.path === '/admin') {
        return '/login'
      }
    })

    await router.navigate('/admin')

    assert.strictEqual(fetchCalls.length, 1)
    assert.strictEqual(fetchCalls[0].url, '/login')
    assert.strictEqual(mockHistory.pushed.length, 0)
    assert.strictEqual(mockHistory.replaced.length, 1)
    assert.strictEqual(mockHistory.replaced[0].url, '/login')
  })

  it('resolves relative path redirects against current path', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    mockWindow.location.pathname = '/admin/dashboard'
    const router = mockWindow.__coralite_router__

    router.beforeEach(({ to }) => {
      if (to.path === '/admin/settings') {
        return 'profile'
      }
    })

    await router.navigate('/admin/settings')

    assert.strictEqual(fetchCalls.length, 1)
    assert.strictEqual(fetchCalls[0].url, '/admin/profile')
    assert.strictEqual(mockHistory.replaced.length, 1)
    assert.strictEqual(mockHistory.replaced[0].url, '/admin/profile')
  })

  it('redirects via location.replace when guard returns external URL', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__

    router.beforeEach(({ to }) => {
      if (to.path === '/external') {
        return 'https://example.com/auth'
      }
    })

    await router.navigate('/external')

    assert.strictEqual(fetchCalls.length, 0)
    assert.strictEqual(replacedLocations.length, 1)
    assert.strictEqual(replacedLocations[0], 'https://example.com/auth')
    assert.strictEqual(mockHistory.pushed.length, 0)
  })

  it('cancels navigation and logs error in dev mode when a guard throws', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__

    router.beforeEach(() => {
      throw new Error('Guard failure')
    })

    await router.navigate('/protected')

    assert.strictEqual(fetchCalls.length, 0)
    assert.strictEqual(mockHistory.pushed.length, 0)
    assert.strictEqual(loggedErrors.length, 1)
    assert.strictEqual(loggedErrors[0][0], 'Guard error:')
    assert.strictEqual(loggedErrors[0][1].message, 'Guard failure')
  })

  it('runs multiple guards in registration order and supports async guards', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__
    const executionOrder = []

    router.beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      executionOrder.push('guard1')
    })

    router.beforeEach(() => {
      executionOrder.push('guard2')
    })

    await router.navigate('/about')

    assert.deepStrictEqual(executionOrder, ['guard1', 'guard2'])
    assert.strictEqual(fetchCalls.length, 1)
  })

  it('cancels navigation silently if aborted via signal', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__

    router.beforeEach(async ({ signal }) => {
      await new Promise(resolve => setTimeout(resolve, 50))
      if (signal.aborted) {
        return
      }
    })

    const nav1 = router.navigate('/slow')
    const nav2 = router.navigate('/fast')

    await Promise.all([nav1, nav2])

    assert.strictEqual(fetchCalls.length, 1)
    assert.strictEqual(fetchCalls[0].url, '/fast')
  })

  it('cancels with dev log when redirect depth exceeds 10', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__

    router.beforeEach(({ to }) => {
      if (to.path.startsWith('/loop')) {
        return to.path + '-x'
      }
    })

    await router.navigate('/loop')

    assert.strictEqual(fetchCalls.length, 0)
    assert.strictEqual(loggedErrors.length, 1)
    assert.strictEqual(loggedErrors[0][0], 'Redirect loop detected')
  })

  it('updates URL strictly after all guards pass', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const router = mockWindow.__coralite_router__
    let urlDuringGuard = null

    router.beforeEach(() => {
      urlDuringGuard = mockWindow.location.pathname
    })

    await router.navigate('/about')

    assert.strictEqual(urlDuringGuard, '/', 'URL was still / during guard execution')
    assert.strictEqual(mockHistory.pushed.length, 1)
    assert.strictEqual(mockHistory.pushed[0].url, '/about')
    assert.strictEqual(mockWindow.location.pathname, '/about', 'URL updated after guard execution')
  })

  it('exposes beforeEach via plugin context router object', () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const phase1 = pluginInstance.client.context
    const phase2 = phase1({})
    const ctx = phase2({})

    assert.ok(ctx.beforeEach, 'beforeEach present in context')
    assert.strictEqual(typeof ctx.beforeEach, 'function')

    let guardRun = false
    const dispose = ctx.beforeEach(() => {
      guardRun = true
    })

    assert.strictEqual(typeof dispose, 'function')
    dispose()
    assert.strictEqual(guardRun, false)
  })
})
