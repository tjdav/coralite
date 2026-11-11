import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { setupPageRuntime } from '../../../lib/client/element.js'

describe('Page Client Runtime Execution', () => {
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

  it('setupPageRuntime executes client block, binds getters, styles, and reactive state on document.documentElement', async () => {
    document.documentElement.innerHTML = '<head></head><body><h1 id="title" data-coralite-page-token="token-0">{{ greeting }}</h1><p id="count-display" data-coralite-page-token="token-1">{{ count }}</p></body>'
    document.documentElement.removeAttribute('style')
    document.documentElement.removeAttribute('data-client-ran')

    let clientExecuted = false
    let receivedState = null
    let observedCount = null

    const pageConfig = {
      state: {
        name: 'Alice',
        count: 0
      },
      route: { path: '/home' },
      getters: {
        greeting: ({ state, route }) => `Hello ${state.name} at ${route.path}`
      },
      style: {
        '--page-count': ({ state }) => state.count
      },
      tokens: {
        'token-0': {
          attrs: {},
          texts: [{
            textIndex: 0,
            raw: '{{ greeting }}'
          }]
        },
        'token-1': {
          attrs: {},
          texts: [{
            textIndex: 0,
            raw: '{{ count }}'
          }]
        }
      },
      client: async ({ state, observe, route }) => {
        clientExecuted = true
        receivedState = state
        document.documentElement.setAttribute('data-client-ran', 'true')
        document.documentElement.setAttribute('data-route-path', route.path)

        observe('count', (newVal) => {
          observedCount = newVal
        })
      }
    }

    await setupPageRuntime(pageConfig)

    assert.equal(clientExecuted, true)
    assert.equal(document.documentElement.getAttribute('data-client-ran'), 'true')
    assert.equal(document.documentElement.querySelector('#title').textContent, 'Hello Alice at /home')
    assert.equal(document.documentElement.querySelector('#count-display').textContent, '0')
    assert.ok(document.documentElement.getAttribute('style')?.includes('--page-count: 0'))

    // Mutate state and verify reactivity
    receivedState.count = 42
    assert.equal(observedCount, 42)

    await new Promise(resolve => setTimeout(resolve, 10))

    assert.equal(document.documentElement.querySelector('#count-display').textContent, '42')
    assert.ok(document.documentElement.getAttribute('style')?.includes('--page-count: 42'))
  })

  it('injects imperative DOM helpers into serialized page client strings', async () => {
    document.documentElement.innerHTML = '<head></head><body><div id="mount"></div></body>'

    const pageConfig = {
      route: { path: '/' },
      client: `function client ({ root }) {
        const mount = root.querySelector('#mount')
        mount.innerHTML = processHTMLTarget(mount, '<span class="from-page-client">ok</span>')
        const el = createCoraliteElement('div')
        el.id = 'created-by-page-client'
        document.body.appendChild(el)
      }`
    }

    await setupPageRuntime(pageConfig)

    assert.equal(document.querySelector('#mount .from-page-client').textContent, 'ok')
    assert.equal(document.querySelector('#created-by-page-client').tagName, 'DIV')
  })

  it('preserves pre-rendered HTML on boot for type: html tokens and reactively updates innerHTML on flush', async () => {
    // Simulated SSR DOM where <c-token> already has rendered HTML child nodes
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <div id="container">
          <c-token data-coralite-page-token="html-token-0"><span class="badge">SSR Content</span></c-token>
        </div>
      </body>
    `
    const cTokenEl = document.querySelector('[data-coralite-page-token="html-token-0"]')
    const initialBadge = cTokenEl.querySelector('.badge')
    assert.ok(initialBadge, 'Initial badge element exists')

    let receivedState = null

    const pageConfig = {
      state: {
        rawHtml: '<span class="badge">SSR Content</span>'
      },
      tokens: {
        'html-token-0': {
          attrs: {},
          texts: [{
            textIndex: 0,
            type: 'html',
            raw: '{{ rawHtml }}'
          }]
        }
      },
      client: async ({ state }) => {
        receivedState = state
      }
    }

    await setupPageRuntime(pageConfig)

    // On initial setup, innerHTML must not be replaced/overwritten if already rendered
    assert.equal(cTokenEl.querySelector('.badge'), initialBadge, 'Pre-rendered DOM element node was preserved and not re-stamped')

    // On reactive state flush, innerHTML should update to new content
    receivedState.rawHtml = '<p class="updated">New Reactive Content</p>'

    await new Promise(resolve => setTimeout(resolve, 10))

    assert.equal(cTokenEl.innerHTML, '<p class="updated">New Reactive Content</p>')
    assert.ok(cTokenEl.querySelector('.updated'))
  })

  it('renders raw {{ token }} for type: html when template was not pre-rendered (synthetic unit test fallback)', async () => {
    document.documentElement.innerHTML = `
      <head></head>
      <body>
        <c-token data-coralite-page-token="html-token-raw">{{ content }}</c-token>
      </body>
    `
    const cTokenEl = document.querySelector('[data-coralite-page-token="html-token-raw"]')

    const pageConfig = {
      state: {
        content: '<em class="highlight">Italic Content</em>'
      },
      tokens: {
        'html-token-raw': {
          attrs: {},
          texts: [{
            textIndex: 0,
            type: 'html',
            raw: '{{ content }}'
          }]
        }
      },
      client: async () => {
      }
    }

    await setupPageRuntime(pageConfig)

    assert.equal(cTokenEl.innerHTML, '<em class="highlight">Italic Content</em>')
    assert.ok(cTokenEl.querySelector('.highlight'))
  })
})
