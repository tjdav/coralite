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
    document.documentElement.innerHTML = '<head></head><body><h1 id="title">{{ greeting }}</h1><p id="count-display">{{ count }}</p></body>'
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
})
