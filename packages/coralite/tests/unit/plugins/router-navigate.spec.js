import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin from '../../../plugins/router.js'

describe('Router Plugin Navigate Unit Tests', () => {
  let mockDom
  let mockOutlet
  let mockRuntime
  let mockHistory
  let mockWindow
  let fetchCalls

  beforeEach(() => {
    fetchCalls = []

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
  })

  it('runs init and sets up click listener and router context', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    assert.ok(mockOutlet.listeners.click, 'Click listener attached to outlet')
    assert.ok(mockWindow.listeners.popstate, 'Popstate listener attached to window')
    assert.ok(mockWindow.__coralite_router__, '__coralite_router__ exposed on window')

    const phase1 = pluginInstance.client.context
    const phase2 = phase1({})
    const ctx = phase2({})
    assert.strictEqual(typeof ctx.navigate, 'function')
    assert.deepStrictEqual(ctx.current(), {
      path: '/'
    })
  })

  it('delegates click on internal links inside outlet', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const clickListener = mockOutlet.listeners.click

    // 1. Internal link
    let defaultPrevented = false
    const internalAnchor = {
      href: 'http://localhost:3000/about',
      closest (sel) {
        return sel === 'a[href]' ? this : null
      },
      hasAttribute () {
        return false
      }
    }

    clickListener({
      defaultPrevented: false,
      button: 0,
      target: internalAnchor,
      preventDefault () {
        defaultPrevented = true
      }
    })

    assert.ok(defaultPrevented, 'Event default prevented')
    assert.strictEqual(fetchCalls.length, 1)
    assert.strictEqual(fetchCalls[0].url, '/about')

    // 2. External link
    fetchCalls = []
    defaultPrevented = false
    const externalAnchor = {
      href: 'https://example.com/about',
      closest (sel) {
        return sel === 'a[href]' ? this : null
      },
      hasAttribute () {
        return false
      }
    }

    clickListener({
      defaultPrevented: false,
      button: 0,
      target: externalAnchor,
      preventDefault () {
        defaultPrevented = true
      }
    })

    assert.strictEqual(defaultPrevented, false)
    assert.strictEqual(fetchCalls.length, 0)

    // 3. Modifier key click
    fetchCalls = []
    defaultPrevented = false
    clickListener({
      defaultPrevented: false,
      button: 0,
      metaKey: true,
      target: internalAnchor,
      preventDefault () {
        defaultPrevented = true
      }
    })
    assert.strictEqual(defaultPrevented, false)
    assert.strictEqual(fetchCalls.length, 0)

    // 4. Target _blank link
    fetchCalls = []
    defaultPrevented = false
    const blankAnchor = {
      href: 'http://localhost:3000/about',
      target: '_blank',
      closest (sel) {
        return sel === 'a[href]' ? this : null
      },
      hasAttribute () {
        return false
      }
    }
    clickListener({
      defaultPrevented: false,
      button: 0,
      target: blankAnchor,
      preventDefault () {
        defaultPrevented = true
      }
    })
    assert.strictEqual(defaultPrevented, false)
    assert.strictEqual(fetchCalls.length, 0)

    // 5. Download attribute link
    fetchCalls = []
    defaultPrevented = false
    const downloadAnchor = {
      href: 'http://localhost:3000/file.pdf',
      closest (sel) {
        return sel === 'a[href]' ? this : null
      },
      hasAttribute (attr) {
        return attr === 'download'
      }
    }
    clickListener({
      defaultPrevented: false,
      button: 0,
      target: downloadAnchor,
      preventDefault () {
        defaultPrevented = true
      }
    })
    assert.strictEqual(defaultPrevented, false)
    assert.strictEqual(fetchCalls.length, 0)

    // 6. data-router-ignore link
    fetchCalls = []
    defaultPrevented = false
    const ignoreAnchor = {
      href: 'http://localhost:3000/about',
      closest (sel) {
        return sel === 'a[href]' ? this : null
      },
      hasAttribute (attr) {
        return attr === 'data-router-ignore'
      }
    }
    clickListener({
      defaultPrevented: false,
      button: 0,
      target: ignoreAnchor,
      preventDefault () {
        defaultPrevented = true
      }
    })
    assert.strictEqual(defaultPrevented, false)
    assert.strictEqual(fetchCalls.length, 0)
  })

  it('performs navigate cycle successfully (fetch, parse, hydration replace, swap, upgrade, head update)', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const fetchedHtml = `
      <html>
        <head>
          <title>New About Title</title>
          <meta name="description" content="About page">
        </head>
        <body>
          <script data-coralite-hydration type="application/json">{"comp-1": {"count": 10}}</script>
          <router-outlet>
            <h1>About Page Content</h1>
          </router-outlet>
        </body>
      </html>
    `

    fetchCalls = []
    globalThis.fetch = async (url, opts) => {
      fetchCalls.push({
        url,
        opts
      })
      return {
        ok: true,
        status: 200,
        text: async () => fetchedHtml
      }
    }

    const newOutletNode = {
      tagName: 'ROUTER-OUTLET',
      childNodes: ['new-child-1']
    }

    const fetchedDoc = {
      querySelector (sel) {
        if (sel === '[data-router-outlet], router-outlet') {
          return newOutletNode
        }
        if (sel === 'script[data-coralite-hydration]') {
          return {
            textContent: '{"comp-1": {"count": 10}}'
          }
        }
        if (sel === 'title') {
          return {
            textContent: 'New About Title'
          }
        }
        return null
      },
      head: {
        querySelectorAll (sel) {
          if (sel === 'meta[name], meta[property]') {
            return [{
              getAttribute (attr) {
                if (attr === 'name') {
                  return 'description'
                }
                if (attr === 'content') {
                  return 'About page'
                }
                return null
              },
              cloneNode () {
                return this
              }
            }]
          }
          return []
        }
      }
    }

    globalThis.DOMParser = class {
      parseFromString () {
        return fetchedDoc
      }
    }

    await mockWindow.__coralite_router__.navigate('/about')

    assert.strictEqual(fetchCalls.length, 1)
    assert.strictEqual(fetchCalls[0].url, '/about')
    assert.strictEqual(fetchCalls[0].opts.headers['X-Coralite-Router'], 'true')

    assert.strictEqual(mockHistory.pushed.length, 1)
    assert.strictEqual(mockHistory.pushed[0].url, '/about')

    assert.deepStrictEqual(mockRuntime.hydrationStore.replaced, {
      'comp-1': {
        count: 10
      }
    })
    assert.deepStrictEqual(mockOutlet.childNodes, ['new-child-1'])
    assert.strictEqual(mockRuntime.upgraded.length, 1)
    assert.strictEqual(mockRuntime.upgraded[0], mockOutlet)
    assert.strictEqual(mockDom.title, 'New About Title')
  })

  it('aborts prior in-flight navigation on rapid navigate calls', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const signals = []
    globalThis.fetch = async (url, opts) => {
      signals.push(opts.signal)
      if (url === '/slow') {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      return {
        ok: true,
        status: 200,
        text: async () => `<router-outlet><h1>${url}</h1></router-outlet>`
      }
    }

    const fetchedDoc = {
      querySelector (sel) {
        if (sel === '[data-router-outlet], router-outlet') {
          return {
            childNodes: ['fast-node']
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

    globalThis.DOMParser = class {
      parseFromString () {
        return fetchedDoc
      }
    }

    const p1 = mockWindow.__coralite_router__.navigate('/slow')
    const p2 = mockWindow.__coralite_router__.navigate('/fast')

    await Promise.all([p1, p2])

    assert.strictEqual(signals[0].aborted, true, 'First fetch signal was aborted')
    assert.strictEqual(signals[1].aborted, false, 'Second fetch signal completed')
    assert.deepStrictEqual(mockOutlet.childNodes, ['fast-node'])
  })

  it('handles popstate events by calling navigate with replace: true', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    fetchCalls = []
    mockWindow.listeners.popstate()

    assert.strictEqual(mockHistory.replaced.length, 1)
  })

  it('throws error when response is not ok and leaves DOM unchanged', async () => {
    const pluginInstance = routerPlugin()
    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    globalThis.fetch = async () => ({
      ok: false,
      status: 404
    })

    await assert.rejects(
      () => mockWindow.__coralite_router__.navigate('/invalid'),
      /Navigation to \/invalid failed: 404/
    )

    assert.deepStrictEqual(mockOutlet.childNodes, ['old-child'])
  })
})
