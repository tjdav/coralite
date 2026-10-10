import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'

const window = new Window()
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.CustomEvent = window.CustomEvent
globalThis.MutationObserver = window.MutationObserver
globalThis.Node = window.Node
globalThis.customElements = window.customElements

const { createCoraliteClass } = await import('../../../lib/coralite-element.js')

describe('Async Getter Dependency Tracking', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('Pre- and Post-Await Dependency Tracking', async () => {
    let observerCalls = 0
    let lastNewVal = null

    const options = {
      componentId: 'test-pre-post-await',
      templateHTML: '<div></div>',
      defaultValues: {
        topic: 'tech',
        filter: 'recent'
      },
      getters: {
        async feed ({ state }) {
          const t = state.topic
          await new Promise(resolve => setTimeout(resolve, 20))
          const f = state.filter
          return `feed:${t}:${f}`
        }
      },
      client ({ observe }) {
        observe('feed', (newVal) => {
          observerCalls++
          lastNewVal = newVal
        })
      }
    }

    const testTag = 'test-pre-post-await'
    const ElementClass = createCoraliteClass(options)
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Wait for initial async getter evaluation
    await new Promise(resolve => setTimeout(resolve, 30))

    // Mutate post-await dependency
    el._state.filter = 'popular'

    // Wait for async getter resolution
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.ok(observerCalls >= 1, 'Observer callback should be invoked when post-await dependency changes')
    assert.equal(lastNewVal, 'feed:tech:popular', 'Observer receives updated post-await resolution')
  })

  it('Resolved Value Delivery to Observer', async () => {
    const receivedValues = []

    const options = {
      componentId: 'test-resolved-value-delivery',
      templateHTML: '<div></div>',
      defaultValues: { count: 1 },
      getters: {
        async asyncVal ({ state }) {
          const c = state.count
          await new Promise(resolve => setTimeout(resolve, 15))
          return c * 10
        }
      },
      client ({ observe }) {
        observe('asyncVal', (newVal, oldVal) => {
          receivedValues.push({ newVal, oldVal })
        })
      }
    }

    const testTag = 'test-resolved-value-delivery'
    const ElementClass = createCoraliteClass(options)
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Wait for initial resolution
    await new Promise(resolve => setTimeout(resolve, 30))

    // Trigger state change
    el._state.count = 2

    // Wait for resolution
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(receivedValues.length, 1, 'Observer should run once on state change')
    assert.notEqual(typeof receivedValues[0].newVal?.then, 'function', 'newVal must not be a Promise')
    assert.notEqual(typeof receivedValues[0].oldVal?.then, 'function', 'oldVal must not be a Promise')
    assert.equal(receivedValues[0].newVal, 20, 'newVal must be the resolved primitive value')
    assert.equal(receivedValues[0].oldVal, 10, 'oldVal must be the previous resolved primitive value')
  })

  it('Multiple Interleaved Async Getters Isolation', async () => {
    const slowCalls = []
    const otherCalls = []

    const options = {
      componentId: 'test-interleaved-isolation',
      templateHTML: '<div></div>',
      defaultValues: {
        sx: 'slow-initial',
        oy: 'other-initial'
      },
      getters: {
        async slow ({ state }) {
          const v = state.sx
          await new Promise(resolve => setTimeout(resolve, 40))
          return `slow:${v}`
        },
        async other ({ state }) {
          const v = state.oy
          await new Promise(resolve => setTimeout(resolve, 10))
          return `other:${v}`
        }
      },
      client ({ observe }) {
        // Register slow first, then other
        observe('slow', (newVal) => slowCalls.push(newVal))
        observe('other', (newVal) => otherCalls.push(newVal))
      }
    }

    const testTag = 'test-interleaved-isolation'
    const ElementClass = createCoraliteClass(options)
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Wait for both initial getters to settle
    await new Promise(resolve => setTimeout(resolve, 60))

    // Mutate only oy (should trigger ONLY other)
    el._state.oy = 'other-updated'
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(slowCalls.length, 0, 'Mutating oy should NOT trigger slow observer')
    assert.equal(otherCalls.length, 1, 'Mutating oy triggers other observer')
    assert.equal(otherCalls[0], 'other:other-updated')

    // Mutate only sx (should trigger ONLY slow)
    el._state.sx = 'slow-updated'
    await new Promise(resolve => setTimeout(resolve, 60))

    assert.equal(slowCalls.length, 1, 'Mutating sx triggers slow observer')
    assert.equal(slowCalls[0], 'slow:slow-updated')
    assert.equal(otherCalls.length, 1, 'other observer is not re-triggered when sx mutates')
  })

  it('4. Nested Getter Dependency Propagation (Probe P5, M1)', async () => {
    let outerCalls = 0
    let lastOuterVal = null

    const options = {
      componentId: 'test-nested-getter-deps',
      templateHTML: '<div></div>',
      defaultValues: { base: 5 },
      getters: {
        inner ({ state }) {
          return state.base * 2
        },
        async outer ({ state }) {
          await new Promise(resolve => setTimeout(resolve, 15))
          const doubled = state.inner
          return `outer:${doubled}`
        }
      },
      client ({ observe }) {
        observe('outer', (newVal) => {
          outerCalls++
          lastOuterVal = newVal
        })
      }
    }

    const testTag = 'test-nested-getter-deps'
    const ElementClass = createCoraliteClass(options)
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Wait for initial outer resolution
    await new Promise(resolve => setTimeout(resolve, 30))

    // Mutate inner getter dependency (base)
    el._state.base = 10
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.ok(outerCalls >= 1, 'Mutating base must trigger outer async getter observer via nested inner dependency propagation')
    assert.equal(lastOuterVal, 'outer:20')
  })

  it('Top-Level Dependency Filtering', async () => {
    const options = {
      componentId: 'test-toplevel-filtering',
      templateHTML: '<div></div>',
      defaultValues: {
        user: {
          profile: {
            name: 'Alice'
          }
        }
      },
      getters: {
        userName ({ state }) {
          return state.user.profile.name
        }
      },
      client ({ observe }) {
        observe('userName', () => {})
      }
    }

    const testTag = 'test-toplevel-filtering'
    const ElementClass = createCoraliteClass(options)
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Inspect recorded dependencies for userName observer
    const records = el._observerRecords
    let userNameRecord = null
    for (const rec of records) {
      if (rec.key === 'userName') {
        userNameRecord = rec
        break
      }
    }

    assert.ok(userNameRecord, 'ObserverRecord for userName should exist')
    const deps = Array.from(userNameRecord.dependencies)
    assert.deepEqual(deps, ['user'], 'Observer dependencies should strictly contain top-level state keys, ignoring sub-properties')
  })

  it('In-Flight Invalidation & Out-of-Order Guard', async () => {
    const observerValues = []

    const options = {
      componentId: 'test-inflight-invalidation',
      templateHTML: '<div></div>',
      defaultValues: { query: 'v1' },
      getters: {
        async search ({ state }) {
          const q = state.query
          const delay = q === 'v1' ? 50 : 10
          await new Promise(resolve => setTimeout(resolve, delay))
          return `result:${q}`
        }
      },
      client ({ observe }) {
        observe('search', (newVal) => observerValues.push(newVal))
      }
    }

    const testTag = 'test-inflight-invalidation'
    const ElementClass = createCoraliteClass(options)
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Wait for initial v1 setup
    await new Promise(resolve => setTimeout(resolve, 60))

    // Trigger rapid updates: set query to v1-new (slow), then query to v2-fast (fast)
    el._state.query = 'v1'
    el._state.query = 'v2'

    // Wait for both to complete
    await new Promise(resolve => setTimeout(resolve, 80))

    assert.equal(observerValues.length, 1, 'Only the latest valid resolution should invoke the observer callback')
    assert.equal(observerValues[0], 'result:v2', 'Stale slower resolution (v1) must be invalidated and discarded')
  })

  it('Disconnection and Rejection Resilience', async () => {
    let consoleErrors = []
    const originalConsoleError = console.error
    console.error = (...args) => {
      consoleErrors.push(args.join(' '))
    }

    let callbacksAfterDisconnect = 0

    try {
      const options = {
        componentId: 'test-disconnection-rejection',
        templateHTML: '<div></div>',
        defaultValues: { mode: 'normal' },
        getters: {
          async data ({ state }) {
            if (state.mode === 'abort') {
              const err = new Error('Aborted')
              err.name = 'AbortError'
              throw err
            }
            if (state.mode === 'error') {
              throw new Error('Unexpected Database Failure')
            }
            await new Promise(resolve => setTimeout(resolve, 30))
            return `data:${state.mode}`
          }
        },
        client ({ observe }) {
          observe('data', () => {
            callbacksAfterDisconnect++
          })
        }
      }

      const testTag = 'test-disconnection-rejection'
      const ElementClass = createCoraliteClass(options)
      if (!customElements.get(testTag)) {
        customElements.define(testTag, ElementClass)
      }

      const el = document.createElement(testTag)
      document.body.appendChild(el)

      // Wait for initial resolution
      await new Promise(resolve => setTimeout(resolve, 50))
      callbacksAfterDisconnect = 0

      // Test AbortError suppression
      el._state.mode = 'abort'
      await new Promise(resolve => setTimeout(resolve, 20))
      assert.equal(consoleErrors.length, 0, 'AbortError must be silently ignored without logging')

      // Test Unexpected Error logging
      el._state.mode = 'error'
      await new Promise(resolve => setTimeout(resolve, 20))
      assert.ok(consoleErrors.length >= 1, 'Unexpected errors must be logged to console.error')
      assert.ok(consoleErrors[0].includes('Coralite Async Getter Error:'), 'Error message contains expected prefix')

      // Reset and test Disconnection mid-flight
      consoleErrors = []
      el._state.mode = 'slow'
      // Disconnect immediately while 'slow' is pending
      el.remove()

      await new Promise(resolve => setTimeout(resolve, 50))
      assert.equal(callbacksAfterDisconnect, 0, 'Disconnected element must drop pending async getter resolutions')
    } finally {
      console.error = originalConsoleError
    }
  })
})
