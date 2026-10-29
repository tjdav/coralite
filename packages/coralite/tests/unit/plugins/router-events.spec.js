import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin from '../../../plugins/router.js'

describe('Router Plugin Events Unit Tests', () => {
  let mockDom
  let mockOutlet
  let mockRuntime
  let mockHistory
  let mockWindow
  let fetchCalls
  let dispatchedEvents

  beforeEach(() => {
    fetchCalls = []
    dispatchedEvents = []

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
        pathname: '/dashboard',
        search: '?user=1',
        hash: '#top'
      },
      history: mockHistory,
      eventListeners: {},
      addEventListener (type, fn) {
        if (!this.eventListeners[type]) {
          this.eventListeners[type] = []
        }
        this.eventListeners[type].push(fn)
      },
      dispatchEvent (evt) {
        dispatchedEvents.push(evt)
        let defaultPrevented = false
        evt.preventDefault = () => {
          if (evt.cancelable) {
            defaultPrevented = true
            evt.defaultPrevented = true
          }
        }
        const listeners = this.eventListeners[evt.type] || []
        for (const listener of listeners) {
          listener(evt)
        }
        return !defaultPrevented
      },
      scrollTo () {
      }
    }

    globalThis.window = mockWindow
    globalThis.document = mockDom
    globalThis.history = mockHistory
    globalThis.location = mockWindow.location
    globalThis.CustomEvent = class CustomEvent {
      constructor (type, options = {}) {
        this.type = type
        this.bubbles = Boolean(options.bubbles)
        this.composed = Boolean(options.composed)
        this.cancelable = Boolean(options.cancelable)
        this.detail = options.detail
        this.defaultPrevented = false
      }
    }
    globalThis.fetch = async (url, opts) => {
      fetchCalls.push({
        url,
        opts
      })
      return {
        ok: true,
        status: 200,
        text: async () => '<router-outlet><h1>Page</h1></router-outlet>'
      }
    }
    globalThis.DOMParser = class {
      parseFromString () {
        return {
          querySelector (sel) {
            if (sel === '[data-router-outlet], router-outlet') {
              return { childNodes: ['new-node'] }
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
  })

  it('dispatches coralite:navigating on window after guards pass and before pushState', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    let navigatingFired = false
    let pushStateCountAtNavigating = -1

    mockWindow.addEventListener('coralite:navigating', (event) => {
      navigatingFired = true
      pushStateCountAtNavigating = mockHistory.pushed.length
      assert.strictEqual(event.type, 'coralite:navigating')
      assert.strictEqual(event.bubbles, true)
      assert.strictEqual(event.composed, true)
      assert.strictEqual(event.cancelable, true)
      assert.deepStrictEqual(event.detail, {
        from: '/dashboard?user=1#top',
        to: '/admin/users'
      })
    })

    await mockWindow.__coralite_router__.navigate('/admin/users')

    assert.ok(navigatingFired, 'coralite:navigating was fired')
    assert.strictEqual(pushStateCountAtNavigating, 0, 'pushState had not been called yet when navigating fired')
    assert.strictEqual(mockHistory.pushed.length, 1, 'pushState was called after navigating event')
  })

  it('cancels navigation when preventDefault() is called on coralite:navigating', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    mockWindow.addEventListener('coralite:navigating', (event) => {
      event.preventDefault()
    })

    await mockWindow.__coralite_router__.navigate('/admin/users')

    assert.strictEqual(mockHistory.pushed.length, 0, 'No URL update')
    assert.strictEqual(fetchCalls.length, 0, 'No fetch')
    assert.deepStrictEqual(mockOutlet.childNodes, ['old-child'], 'No swap')
    const navigatedEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigated')
    assert.strictEqual(navigatedEvents.length, 0, 'No navigated event fired')
  })

  it('dispatches coralite:navigated after swap and upgrade complete', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    let navigatedFired = false
    let upgradedAtNavigated = false

    mockWindow.addEventListener('coralite:navigated', (event) => {
      navigatedFired = true
      upgradedAtNavigated = mockRuntime.upgraded.length === 1
      assert.strictEqual(event.type, 'coralite:navigated')
      assert.strictEqual(event.bubbles, true)
      assert.strictEqual(event.composed, true)
      assert.strictEqual(event.cancelable, false)
      assert.deepStrictEqual(event.detail, {
        from: '/dashboard?user=1#top',
        to: '/admin/users'
      })
    })

    await mockWindow.__coralite_router__.navigate('/admin/users')

    assert.ok(navigatedFired, 'coralite:navigated was fired')
    assert.ok(upgradedAtNavigated, 'upgrade was complete when navigated fired')
  })

  it('does not fire coralite:navigating or coralite:navigated when guard cancels navigation', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    mockWindow.__coralite_router__.beforeEach(() => false)

    await mockWindow.__coralite_router__.navigate('/admin/users')

    assert.strictEqual(dispatchedEvents.length, 0, 'No router events fired')
  })

  it('does not fire coralite:navigated when fetch fails', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    globalThis.fetch = async () => ({
      ok: false,
      status: 500
    })

    await assert.rejects(
      () => mockWindow.__coralite_router__.navigate('/failing'),
      /Navigation to \/failing failed: 500/
    )

    const navigatingEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigating')
    const navigatedEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigated')

    assert.strictEqual(navigatingEvents.length, 1, 'navigating fired')
    assert.strictEqual(navigatedEvents.length, 0, 'navigated did NOT fire on failure')
  })

  it('handles rapid navigation aborts correctly (navigating may fire, navigated fires only for completing nav)', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    globalThis.fetch = async (url, opts) => {
      fetchCalls.push({
        url,
        opts
      })
      if (url === '/slow') {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return {
        ok: true,
        status: 200,
        text: async () => `<router-outlet><h1>${url}</h1></router-outlet>`
      }
    }

    const p1 = mockWindow.__coralite_router__.navigate('/slow')
    const p2 = mockWindow.__coralite_router__.navigate('/fast')

    await Promise.all([p1, p2])

    const navigatingEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigating')
    const navigatedEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigated')

    assert.strictEqual(navigatingEvents.length, 2, 'navigating fired for both')
    assert.strictEqual(navigatedEvents.length, 1, 'navigated fired only once')
    assert.strictEqual(navigatedEvents[0].detail.to, '/fast', 'navigated fired for completing navigation')
  })

  it('does not fire events on initial client.init page load', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    assert.strictEqual(dispatchedEvents.length, 0, 'No events fired during init')
  })

  it('dispatches both events on popstate navigation', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    dispatchedEvents = []
    const popstateListener = mockWindow.eventListeners.popstate[0]
    popstateListener()

    await new Promise(resolve => setTimeout(resolve, 10))

    const navigatingEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigating')
    const navigatedEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigated')

    assert.strictEqual(navigatingEvents.length, 1)
    assert.strictEqual(navigatedEvents.length, 1)
  })

  it('falls back to sync swap when startViewTransition throws non-AbortError', async () => {
    const pluginInstance = routerPlugin()
    mockWindow.__coralite_hydration__ = { viewTransitions: true }
    globalThis.document.startViewTransition = () => {
      throw new Error('startViewTransition failed')
    }

    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    await mockWindow.__coralite_router__.navigate('/admin/users')

    assert.deepStrictEqual(mockOutlet.childNodes, ['new-node'], 'Swap fell back to sync swap')
    const navigatedEvents = dispatchedEvents.filter(e => e.type === 'coralite:navigated')
    assert.strictEqual(navigatedEvents.length, 1, 'coralite:navigated still fired')
  })

  it('does not double-swap if view transition callback already ran before transition rejection', async () => {
    const pluginInstance = routerPlugin()
    mockWindow.__coralite_hydration__ = { viewTransitions: true }

    let swapCallCount = 0
    const originalReplaceChildren = mockOutlet.replaceChildren
    mockOutlet.replaceChildren = function (...nodes) {
      swapCallCount++
      originalReplaceChildren.apply(this, nodes)
    }

    globalThis.document.startViewTransition = (cb) => {
      const callbackPromise = cb()
      return {
        updateCallbackDone: callbackPromise,
        finished: (async () => {
          await callbackPromise
          throw new Error('Animation error after swap')
        })()
      }
    }

    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    await mockWindow.__coralite_router__.navigate('/admin/users')

    assert.strictEqual(swapCallCount, 1, 'replaceChildren called exactly once')
    assert.deepStrictEqual(mockOutlet.childNodes, ['new-node'])
  })

  it('skips DOM swap if navigation signal is aborted before VT callback runs', async () => {
    const pluginInstance = routerPlugin()
    mockWindow.__coralite_hydration__ = { viewTransitions: true }

    let callbackRan = false
    let isFirst = true
    globalThis.document.startViewTransition = (cb) => {
      const p = (async () => {
        if (isFirst) {
          isFirst = false
          // Simulate second navigation aborting the first one before cb runs
          mockWindow.__coralite_router__.navigate('/fast')
        }
        await cb()
        callbackRan = true
      })()
      return {
        updateCallbackDone: p,
        finished: p
      }
    }

    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    await mockWindow.__coralite_router__.navigate('/slow')

    assert.ok(callbackRan, 'Callback was called by browser')
    assert.deepStrictEqual(mockOutlet.childNodes, ['new-node'])
  })
})
