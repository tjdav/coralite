import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { createContext, ContextRequestEvent } from '../../../lib/utils/core.js'

describe('W3C Web Components Context Protocol', () => {
  let window
  let document
  let createCoraliteClass

  beforeEach(async () => {
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

    const module = await import('../../../lib/coralite-element.js')
    createCoraliteClass = module.createCoraliteClass
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
    const event = new ContextRequestEvent('interop-key', (val) => {
      receivedValue = val
    })

    provider.dispatchEvent(event)

    assert.equal(receivedValue, 'interop-val')
  })

  it('8. createContext Pass-Through & Unique Symbols', () => {
    const stringKey = createContext('theme')
    assert.equal(stringKey, 'theme')

    const symKey = Symbol('custom')
    const passSym = createContext(symKey)
    assert.equal(passSym, symKey)

    const objKey = { id: 'obj-key' }
    const passObj = createContext(objKey)
    assert.equal(passObj, objKey)

    const generatedSym1 = createContext()
    const generatedSym2 = createContext(undefined)
    assert.equal(typeof generatedSym1, 'symbol')
    assert.equal(typeof generatedSym2, 'symbol')
    assert.notEqual(generatedSym1, generatedSym2)
  })

  it('9. Map Provider & Object Reference Context Key', () => {
    const objectToken = createContext({ name: 'user-token' })

    const providerMap = new Map([
      [objectToken, ({ state }) => state.userName]
    ])

    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-map',
      defaultValues: { userName: 'Alice' },
      provide: providerMap
    })

    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-map',
      consume: {
        userName: objectToken
      }
    })

    customElements.define('test-provider-9', ProviderClass)
    customElements.define('test-consumer-9', ConsumerClass)

    const provider = document.createElement('test-provider-9')
    const consumer = document.createElement('test-consumer-9')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    assert.equal(consumer._state.userName, 'Alice')

    provider._state.userName = 'Bob'
    assert.equal(consumer._state.userName, 'Bob')
  })

  it('10. Strict Object Consumer Mapping', () => {
    const themeToken = createContext('theme-token')
    const countToken = createContext('count-token')

    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-object-consumer',
      defaultValues: { countVal: 10 },
      provide: {
        [themeToken]: 'dark',
        [countToken]: ({ state }) => state.countVal
      }
    })

    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-object-consumer',
      consume: {
        activeTheme: themeToken,
        activeCount: { context: countToken, default: 0 }
      }
    })

    customElements.define('test-provider-10', ProviderClass)
    customElements.define('test-consumer-10', ConsumerClass)

    const provider = document.createElement('test-provider-10')
    const consumer = document.createElement('test-consumer-10')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    assert.equal(consumer._state.activeTheme, 'dark')
    assert.equal(consumer._state.activeCount, 10)

    provider._state.countVal = 99
    assert.equal(consumer._state.activeCount, 99)
  })

  it('11. Non-Subscribing Consumer (subscribe: false)', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-oneshot',
      defaultValues: { val: 'initial' },
      provide: {
        'oneshot-key': ({ state }) => state.val
      }
    })

    customElements.define('test-provider-11', ProviderClass)

    const provider = document.createElement('test-provider-11')
    document.body.appendChild(provider)

    let receivedValue = null
    let receivedUnsub = 'sentinel'

    const event = new ContextRequestEvent('oneshot-key', (val, unsub) => {
      receivedValue = val
      receivedUnsub = unsub
    }, false)

    provider.dispatchEvent(event)

    assert.equal(receivedValue, 'initial')
    assert.equal(receivedUnsub, undefined)

    // Verify callback was NOT retained in provider subscriptions
    assert.equal(provider._contextSubscriptions?.has('oneshot-key'), false)
  })

  it('12. WeakRef Subscription Pruning on State Mutation', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-weakref',
      defaultValues: { count: 1 },
      provide: {
        'weak-key': ({ state }) => state.count
      }
    })

    customElements.define('test-provider-12', ProviderClass)

    const provider = document.createElement('test-provider-12')
    document.body.appendChild(provider)

    let deadCallbackCalled = false
    let deadCallback = (val) => {
      deadCallbackCalled = true
    }

    const event = new ContextRequestEvent('weak-key', deadCallback, true)
    provider.dispatchEvent(event)

    assert.equal(provider._contextSubscriptions.has('weak-key'), true)

    // The callback was legitimately invoked once at dispatch with the initial value.
    deadCallbackCalled = false

    // Simulate callback garbage collection by replacing callbackRef with a deref returning undefined
    const subs = provider._contextSubscriptions.get('weak-key')
    for (const sub of subs) {
      sub.callbackRef = { deref: () => undefined }
    }

    provider._state.count = 2

    assert.equal(deadCallbackCalled, false)
    assert.equal(provider._contextSubscriptions.has('weak-key'), false)
  })

  it('13. DisconnectedCallback Lifecycle Teardown', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-teardown',
      provide: {
        'td-key': 'value'
      }
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-teardown',
      consume: ['td-key']
    })

    customElements.define('test-provider-13', ProviderClass)
    customElements.define('test-consumer-13', ConsumerClass)

    const provider = document.createElement('test-provider-13')
    const consumer = document.createElement('test-consumer-13')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    assert.equal(consumer._state.tdKey, 'value')

    // Disconnect consumer
    provider.removeChild(consumer)
    assert.equal(consumer._contextUnsubscribers.length, 0)
    assert.equal(consumer._contextCallbacks.length, 0)

    // Disconnect provider
    document.body.removeChild(provider)
    assert.equal(provider._contextSubscriptions.size, 0)
  })

  it('14. Defensive Consumer Error Isolation', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-error-iso',
      defaultValues: { val: 'a' },
      provide: {
        'err-key': ({ state }) => state.val
      }
    })

    customElements.define('test-provider-14', ProviderClass)

    const provider = document.createElement('test-provider-14')
    document.body.appendChild(provider)

    let siblingValue = null
    const throwingCallback = (val) => {
      if (val === 'b') {
        throw new Error('Consumer callback boom!')
      }
    }
    const siblingCallback = (val) => {
      siblingValue = val
    }

    const microtaskErrors = []
    const origQueueMicrotask = global.queueMicrotask
    global.queueMicrotask = (fn) => {
      try {
        fn()
      } catch (err) {
        microtaskErrors.push(err)
      }
    }

    try {
      const event1 = new ContextRequestEvent('err-key', throwingCallback, true)
      const event2 = new ContextRequestEvent('err-key', siblingCallback, true)

      provider.dispatchEvent(event1)
      provider.dispatchEvent(event2)

      assert.equal(siblingValue, 'a')

      // Mutate state to trigger notification loop where one subscriber throws
      provider._state.val = 'b'

      assert.equal(siblingValue, 'b')
      assert.equal(microtaskErrors.length, 1)
      assert.equal(microtaskErrors[0].message, 'Consumer callback boom!')
    } finally {
      global.queueMicrotask = origQueueMicrotask
    }
  })

  it('15. Consumer Default Fallback when Unmatched', () => {
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-fallback',
      consume: {
        mode: { context: 'unprovided-key', default: 'fallback-mode' }
      }
    })

    customElements.define('test-consumer-15', ConsumerClass)

    const consumer = document.createElement('test-consumer-15')
    document.body.appendChild(consumer)

    assert.equal(consumer._state.mode, 'fallback-mode')
  })

  it('16. Preserved Dashed Array Shorthand Dual-Binding', () => {
    const ProviderClass = createCoraliteClass({
      componentId: 'test-provider-dash',
      provide: {
        'user-auth-token': 'jwt-12345'
      }
    })
    const ConsumerClass = createCoraliteClass({
      componentId: 'test-consumer-dash',
      consume: ['user-auth-token']
    })

    customElements.define('test-provider-16', ProviderClass)
    customElements.define('test-consumer-16', ConsumerClass)

    const provider = document.createElement('test-provider-16')
    const consumer = document.createElement('test-consumer-16')

    provider.appendChild(consumer)
    document.body.appendChild(provider)

    assert.equal(consumer._state['user-auth-token'], 'jwt-12345')
    assert.equal(consumer._state.userAuthToken, 'jwt-12345')
  })
})
