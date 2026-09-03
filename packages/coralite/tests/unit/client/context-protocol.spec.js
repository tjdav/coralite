import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'

describe('W3C Web Components Context Protocol', () => {
  let window
  let document
  let createCoraliteClass

  beforeEach(async () => {
    window = new Window({ url: 'http://localhost' })
    document = window.document
    global.window = window
    global.document = document
    global.HTMLElement = window.HTMLElement
    global.CustomEvent = window.CustomEvent
    global.MutationObserver = window.MutationObserver
    global.Node = window.Node
    global.customElements = window.customElements

    const module = await import('../../../lib/coralite-element.js')
    createCoraliteClass = module.createCoraliteClass
  })

  afterEach(() => {
    delete global.window
    delete global.document
    delete global.HTMLElement
    delete global.CustomEvent
    delete global.MutationObserver
    delete global.Node
    delete global.customElements
  })

  it('1. Basic Context Handshake', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider',
      provide: {
        'theme-context': 'dark'
      }
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer',
      consume: ['theme-context']
    })

    customElements.define('test-provider-1', ProviderClass)
    customElements.define('test-consumer-1', ConsumerClass)

    const provider = document.createElement('test-provider-1')
    const consumer = document.createElement('test-consumer-1')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    assert.equal(consumer._state.themeContext, 'dark')
    assert.equal(consumer._state['theme-context'], 'dark')
  })

  it('2. Reactive Provider Propagation', async () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-reactive',
      defaultValues: { theme: 'dark' },
      provide: {
        'theme-context': ({ state }) => state.theme
      }
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-reactive',
      consume: ['theme-context']
    })

    customElements.define('test-provider-2', ProviderClass)
    customElements.define('test-consumer-2', ConsumerClass)

    const provider = document.createElement('test-provider-2')
    const consumer = document.createElement('test-consumer-2')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    assert.equal(consumer._state.themeContext, 'dark')

    provider._state.theme = 'light'

    assert.equal(consumer._state.themeContext, 'light')
  })

  it('3. Selective Dependency Re-broadcasting', async () => {
    let providerEvalCount = 0

    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-selective',
      defaultValues: { count: 0, unrelated: 'foo' },
      provide: {
        'count-context': ({ state }) => {
          providerEvalCount++
          return state.count
        }
      }
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-selective',
      consume: ['count-context']
    })

    customElements.define('test-provider-3', ProviderClass)
    customElements.define('test-consumer-3', ConsumerClass)

    const provider = document.createElement('test-provider-3')
    const consumer = document.createElement('test-consumer-3')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    const initialEvals = providerEvalCount
    assert.equal(consumer._state.countContext, 0)

    provider._state.unrelated = 'bar'
    assert.equal(providerEvalCount, initialEvals)

    provider._state.count = 42
    assert.equal(consumer._state.countContext, 42)
    assert.equal(providerEvalCount, initialEvals + 1)
  })

  it('4. Deeply Nested Consumers', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-nested',
      provide: {
        'nested-context': 'deep-value'
      }
    })
    const IntermediateClass = createCoraliteClass({
      componentId: 'test-intermediate'
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-nested',
      consume: ['nested-context']
    })

    customElements.define('test-provider-4', ProviderClass)
    customElements.define('test-intermediate-4', IntermediateClass)
    customElements.define('test-consumer-4', ConsumerClass)

    const provider = document.createElement('test-provider-4')
    const intermediate = document.createElement('test-intermediate-4')
    const consumer = document.createElement('test-consumer-4')

    intermediate.appendChild(consumer)
    provider.appendChild(intermediate)
    document.body.appendChild(provider)

    assert.equal(consumer._state.nestedContext, 'deep-value')
  })

  it('5. DOM Re-parenting', () => {
    const ProviderAClass = createCoraliteClass({
      componentId: 'test-provider-a',
      provide: {
        'theme-context': 'theme-a'
      }
    })
    const ProviderBClass = createCoraliteClass({
      componentId: 'test-provider-b',
      provide: {
        'theme-context': 'theme-b'
      }
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-reparent',
      consume: ['theme-context']
    })

    customElements.define('test-provider-a-5', ProviderAClass)
    customElements.define('test-provider-b-5', ProviderBClass)
    customElements.define('test-consumer-5', ConsumerClass)

    const providerA = document.createElement('test-provider-a-5')
    const providerB = document.createElement('test-provider-b-5')
    const consumer = document.createElement('test-consumer-5')

    providerA.appendChild(consumer)
    document.body.appendChild(providerA)
    document.body.appendChild(providerB)

    assert.equal(consumer._state.themeContext, 'theme-a')

    providerB.appendChild(consumer)

    assert.equal(consumer._state.themeContext, 'theme-b')
  })

  it('6. Symbol Context Keys', () => {
    const themeSymbol = Symbol('theme')

    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-symbol',
      provide: {
        [themeSymbol]: 'symbol-dark'
      }
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-symbol',
      consume: [themeSymbol]
    })

    customElements.define('test-provider-6', ProviderClass)
    customElements.define('test-consumer-6', ConsumerClass)

    const provider = document.createElement('test-provider-6')
    const consumer = document.createElement('test-consumer-6')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    assert.equal(consumer._state[themeSymbol], 'symbol-dark')
  })

  it('7. External / W3C Interop', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-interop',
      provide: {
        'interop-key': 'interop-val'
      }
    })

    customElements.define('test-provider-7', ProviderClass)

    const provider = document.createElement('test-provider-7')
    document.body.appendChild(provider)

    let receivedValue = null
    const event = new CustomEvent('context-request', {
      bubbles: true,
      composed: true,
      detail: {
        context: 'interop-key',
        callback: (val) => {
          receivedValue = val
        }
      }
    })

    provider.dispatchEvent(event)

    assert.equal(receivedValue, 'interop-val')
  })
})
