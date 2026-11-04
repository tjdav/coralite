import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import routerPlugin from '../../../plugins/router.js'
import { parseHTML } from '../../../lib/server/utils/parse.js'
import { transformNode } from '../../../lib/server/parser/html.js'

const OUTLET_SELECTOR = '[data-router-outlet], router-outlet'

function renderPage (pluginInstance) {
  const html = '<!DOCTYPE html><html><head></head><body><h1>Hello World</h1></body></html>'
  const parsed = parseHTML(html)
  const component = {
    root: parsed.root
  }
  const app = {
    _explicitPluginNames: new Set(['router'])
  }

  pluginInstance.server.onBeforePageRender({
    component,
    config: pluginInstance.config,
    app
  })

  return transformNode(component.root)
}

describe('Router config flags: autoWrap and outletOnly', () => {
  let mockOutlet
  let mockRuntime
  let mockDocument
  let mockWindow
  let fetchCalls
  let hasOutlet

  beforeEach(() => {
    fetchCalls = []
    hasOutlet = true

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

    const fetchedOutlet = {
      childNodes: ['new-node']
    }

    mockDocument = {
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
        if (sel === OUTLET_SELECTOR) {
          return hasOutlet ? mockOutlet : null
        }
        return null
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

    mockWindow = {
      location: {
        origin: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: ''
      },
      history: {
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
      },
      listeners: {},
      addEventListener (type, fn) {
        this.listeners[type] = fn
      },
      scrollTo () {
      }
    }

    globalThis.window = mockWindow
    globalThis.document = mockDocument
    globalThis.history = mockWindow.history
    globalThis.location = mockWindow.location
    globalThis.fetch = async (url) => {
      fetchCalls.push(url)
      return {
        ok: true,
        status: 200,
        text: async () => '<html><body><router-outlet><h1>Next</h1></router-outlet></body></html>'
      }
    }
    globalThis.DOMParser = class {
      parseFromString () {
        return {
          querySelector (sel) {
            return sel === OUTLET_SELECTOR ? fetchedOutlet : null
          },
          head: mockDocument.head
        }
      }
    }
  })

  it('default flags preserve auto-wrap and default click interception', async () => {
    const pluginInstance = routerPlugin()
    const rendered = renderPage(pluginInstance)

    assert.ok(rendered.includes('<router-outlet data-router-outlet>'))
    assert.strictEqual(pluginInstance.config.autoWrap, true)
    assert.strictEqual(pluginInstance.config.outletOnly, false)

    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const clickListener = mockOutlet.listeners.click
    assert.ok(clickListener, 'click listener attached')

    let prevented = false
    clickListener({
      defaultPrevented: false,
      button: 0,
      target: {
        href: 'http://localhost:3000/next',
        closest (sel) {
          return sel === 'a[href]' ? this : null
        },
        hasAttribute () {
          return false
        }
      },
      preventDefault () {
        prevented = true
      }
    })

    assert.ok(prevented, 'default outletOnly=false intercepts internal links')
    assert.strictEqual(fetchCalls.length, 1)
  })

  it('autoWrap: false does not wrap the page but still intercepts links', () => {
    const pluginInstance = routerPlugin({ autoWrap: false })
    const rendered = renderPage(pluginInstance)

    assert.strictEqual(rendered.includes('<router-outlet'), false)
    assert.strictEqual(rendered.includes('data-router-outlet'), false)

    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    const clickListener = mockOutlet.listeners.click
    assert.ok(clickListener, 'click listener attached')

    let prevented = false
    clickListener({
      defaultPrevented: false,
      button: 0,
      target: {
        href: 'http://localhost:3000/next',
        closest (sel) {
          return sel === 'a[href]' ? this : null
        },
        hasAttribute () {
          return false
        }
      },
      preventDefault () {
        prevented = true
      }
    })

    assert.ok(prevented, 'interception still fires with autoWrap=false')
    assert.strictEqual(fetchCalls.length, 1)
  })

  it('outletOnly: true keeps auto-wrap but skips interception when the outlet is gone', () => {
    const pluginInstance = routerPlugin({ outletOnly: true })
    const rendered = renderPage(pluginInstance)

    assert.ok(rendered.includes('<router-outlet data-router-outlet>'))
    assert.strictEqual(pluginInstance.config.outletOnly, true)

    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    hasOutlet = false

    let prevented = false
    mockOutlet.listeners.click({
      defaultPrevented: false,
      button: 0,
      target: {
        href: 'http://localhost:3000/next',
        closest (sel) {
          return sel === 'a[href]' ? this : null
        },
        hasAttribute () {
          return false
        }
      },
      preventDefault () {
        prevented = true
      }
    })

    assert.strictEqual(prevented, false)
    assert.strictEqual(fetchCalls.length, 0)
  })

  it('autoWrap: false + outletOnly: true produces no wrapper and no interception without an outlet', () => {
    const pluginInstance = routerPlugin({
      autoWrap: false,
      outletOnly: true
    })
    const rendered = renderPage(pluginInstance)

    assert.strictEqual(rendered.includes('<router-outlet'), false)
    assert.strictEqual(pluginInstance.config.autoWrap, false)
    assert.strictEqual(pluginInstance.config.outletOnly, true)

    pluginInstance.client.init({
      config: pluginInstance.config,
      runtime: mockRuntime
    })

    hasOutlet = false

    let prevented = false
    mockOutlet.listeners.click({
      defaultPrevented: false,
      button: 0,
      target: {
        href: 'http://localhost:3000/next',
        closest (sel) {
          return sel === 'a[href]' ? this : null
        },
        hasAttribute () {
          return false
        }
      },
      preventDefault () {
        prevented = true
      }
    })

    assert.strictEqual(prevented, false)
    assert.strictEqual(fetchCalls.length, 0)
  })
})
