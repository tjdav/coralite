import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin from '../../../plugins/router.js'

describe('Router Plugin View Transitions Unit Tests', () => {
  let mockDom
  let mockOutlet
  let mockRuntime
  let mockHistory
  let mockWindow
  let fetchCalls

  beforeEach(() => {
    fetchCalls = []
    delete globalThis.matchMedia

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

    const fetchedDoc = {
      querySelector (sel) {
        if (sel === '[data-router-outlet], router-outlet') {
          return { childNodes: ['new-vt-child'] }
        }
        if (sel === 'title') {
          return { textContent: 'New Title' }
        }
        return null
      },
      head: {
        querySelectorAll () {
          return []
        }
      }
    }

    globalThis.DOMParser = class {
      parseFromString () {
        return fetchedDoc
      }
    }
  })

  it('uses startViewTransition when viewTransitions true and API available', async () => {
    mockWindow.__coralite_hydration__ = { viewTransitions: true }
    let vtCalled = 0
    mockDom.startViewTransition = (cb) => {
      vtCalled++
      const callbackPromise = cb()
      return {
        finished: callbackPromise
      }
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    await mockWindow.__coralite_router__.navigate('/vt-page')

    assert.strictEqual(vtCalled, 1, 'startViewTransition was called once')
    assert.deepStrictEqual(mockOutlet.childNodes, ['new-vt-child'], 'Outlet swapped')
  })

  it('reads viewTransitions dynamically at navigate time', async () => {
    mockWindow.__coralite_hydration__ = { viewTransitions: false }
    let vtCalled = 0
    mockDom.startViewTransition = (cb) => {
      vtCalled++
      const callbackPromise = cb()
      return {
        finished: callbackPromise
      }
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    mockWindow.__coralite_hydration__.viewTransitions = true

    await mockWindow.__coralite_router__.navigate('/vt-page')

    assert.strictEqual(vtCalled, 1, 'startViewTransition was called after viewTransitions updated to true')
    assert.deepStrictEqual(mockOutlet.childNodes, ['new-vt-child'], 'Outlet swapped')
  })

  it('bypasses startViewTransition when viewTransitions false', async () => {
    mockWindow.__coralite_hydration__ = { viewTransitions: false }
    let vtCalled = 0
    mockDom.startViewTransition = (cb) => {
      vtCalled++
      return { finished: cb() }
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    await mockWindow.__coralite_router__.navigate('/vt-page')

    assert.strictEqual(vtCalled, 0, 'startViewTransition was not called')
    assert.deepStrictEqual(mockOutlet.childNodes, ['new-vt-child'], 'Outlet swapped sync')
  })

  it('bypasses startViewTransition when API unavailable', async () => {
    mockWindow.__coralite_hydration__ = { viewTransitions: true }
    delete mockDom.startViewTransition

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    await mockWindow.__coralite_router__.navigate('/vt-page')

    assert.deepStrictEqual(mockOutlet.childNodes, ['new-vt-child'], 'Outlet swapped sync without VT API')
  })

  it('bypasses startViewTransition when prefers-reduced-motion is reduce', async () => {
    mockWindow.__coralite_hydration__ = { viewTransitions: true }
    let vtCalled = 0
    mockDom.startViewTransition = (cb) => {
      vtCalled++
      return { finished: cb() }
    }

    globalThis.matchMedia = (query) => {
      if (query === '(prefers-reduced-motion: reduce)') {
        return { matches: true }
      }
      return { matches: false }
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    await mockWindow.__coralite_router__.navigate('/vt-page')

    assert.strictEqual(vtCalled, 0, 'startViewTransition was not called due to prefers-reduced-motion')
    assert.deepStrictEqual(mockOutlet.childNodes, ['new-vt-child'], 'Outlet swapped sync')
  })

  it('awaits transition.finished before upgrading components', async () => {
    mockWindow.__coralite_hydration__ = { viewTransitions: true }
    const sequence = []

    let resolveFinished
    const finishedPromise = new Promise(resolve => {
      resolveFinished = resolve
    })

    let vtStartedResolve
    const vtStartedPromise = new Promise(resolve => {
      vtStartedResolve = resolve
    })

    mockDom.startViewTransition = (cb) => {
      sequence.push('vt-start')
      vtStartedResolve()
      cb()
      return {
        finished: finishedPromise.then(() => {
          sequence.push('vt-finished')
        })
      }
    }

    mockRuntime.upgrade = async (el) => {
      sequence.push('upgrade')
      mockRuntime.upgraded.push(el)
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const navPromise = mockWindow.__coralite_router__.navigate('/vt-page')

    await vtStartedPromise
    assert.deepStrictEqual(sequence, ['vt-start'], 'Transition started, upgrade not called yet')

    resolveFinished()
    await navPromise

    assert.deepStrictEqual(sequence, ['vt-start', 'vt-finished', 'upgrade'], 'Upgrade called after transition.finished')
  })

  it('dispatches coralite:navigated after transition finishes', async () => {
    mockWindow.__coralite_hydration__ = { viewTransitions: true }
    const sequence = []

    let resolveFinished
    const finishedPromise = new Promise(resolve => {
      resolveFinished = resolve
    })

    let vtStartedResolve
    const vtStartedPromise = new Promise(resolve => {
      vtStartedResolve = resolve
    })

    mockDom.startViewTransition = (cb) => {
      sequence.push('vt-start')
      vtStartedResolve()
      cb()
      return {
        finished: finishedPromise.then(() => {
          sequence.push('vt-finished')
        })
      }
    }

    mockWindow.listeners['coralite:navigated'] = () => {
      sequence.push('coralite:navigated')
    }
    mockWindow.dispatchEvent = (evt) => {
      if (evt && evt.type && mockWindow.listeners[evt.type]) {
        mockWindow.listeners[evt.type](evt)
      }
      return true
    }

    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const navPromise = mockWindow.__coralite_router__.navigate('/vt-page')

    await vtStartedPromise
    assert.deepStrictEqual(sequence, ['vt-start'], 'Transition started, event not dispatched yet')

    resolveFinished()
    await navPromise

    assert.ok(sequence.indexOf('coralite:navigated') > sequence.indexOf('vt-finished'), 'coralite:navigated dispatched after transition finishes')
  })
})
