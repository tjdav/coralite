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

const { createCoraliteClass } = await import('../../../lib/client/element.js')

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

    // Wait for initial async getter evaluation and resolution
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(observerCalls, 1, 'Initial async getter resolution triggers observer')
    assert.equal(lastNewVal, 'feed:tech:recent', 'Observer receives initial resolution')

    // Mutate post-await dependency (filter)
    el._state.filter = 'popular'

    // Wait to confirm post-await mutation does NOT trigger re-evaluation
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(observerCalls, 1, 'Observer should NOT be invoked when post-await dependency changes')
    assert.equal(lastNewVal, 'feed:tech:recent', 'Value remains unchanged on post-await mutation')

    // Mutate pre-await dependency (topic)
    el._state.topic = 'science'

    // Wait for async getter resolution
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(observerCalls, 2, 'Observer should be invoked when pre-await dependency changes')
    assert.equal(lastNewVal, 'feed:science:popular', 'Observer receives updated resolution incorporating pre-await dependency change')
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
          receivedValues.push({
            newVal,
            oldVal
          })
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

    // Initial resolution delivers first value
    assert.equal(receivedValues.length, 1, 'Observer runs once on initial resolution')
    assert.equal(receivedValues[0].newVal, 10, 'Initial newVal is primitive resolved value')

    // Trigger state change
    el._state.count = 2

    // Wait for resolution
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(receivedValues.length, 2, 'Observer runs a second time on state change resolution')
    assert.notEqual(typeof receivedValues[1].newVal?.then, 'function', 'newVal must not be a Promise')
    assert.notEqual(typeof receivedValues[1].oldVal?.then, 'function', 'oldVal must not be a Promise')
    assert.equal(receivedValues[1].newVal, 20, 'newVal must be the resolved primitive value')
    assert.equal(receivedValues[1].oldVal, 10, 'oldVal must be the previous resolved primitive value')
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

    assert.equal(slowCalls.length, 1, 'slow observer fired on initial resolution')
    assert.equal(otherCalls.length, 1, 'other observer fired on initial resolution')

    // Mutate only oy (should trigger ONLY other)
    el._state.oy = 'other-updated'
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(slowCalls.length, 1, 'Mutating oy should NOT re-trigger slow observer')
    assert.equal(otherCalls.length, 2, 'Mutating oy triggers other observer')
    assert.equal(otherCalls[1], 'other:other-updated')

    // Mutate only sx (should trigger ONLY slow)
    el._state.sx = 'slow-updated'
    await new Promise(resolve => setTimeout(resolve, 60))

    assert.equal(slowCalls.length, 2, 'Mutating sx triggers slow observer')
    assert.equal(slowCalls[1], 'slow:slow-updated')
    assert.equal(otherCalls.length, 2, 'other observer is not re-triggered when sx mutates')
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
          const doubled = state.inner
          await new Promise(resolve => setTimeout(resolve, 15))
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

    assert.equal(outerCalls, 1, 'Initial outer resolution fires observer')
    assert.equal(lastOuterVal, 'outer:10')

    // Mutate inner getter dependency (base)
    el._state.base = 10
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(outerCalls, 2, 'Mutating base must trigger outer async getter observer via nested inner dependency propagation')
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
        observe('userName', () => {
        })
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
          const delay = q === 'v1-slow' ? 50 : 10
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
    await new Promise(resolve => setTimeout(resolve, 30))

    assert.equal(observerValues.length, 1, 'Initial query resolution invokes observer')
    assert.equal(observerValues[0], 'result:v1')

    // Trigger rapid updates: set query to v1-slow (slow), then query to v2 (fast)
    el._state.query = 'v1-slow'
    el._state.query = 'v2'

    // Wait for both to complete
    await new Promise(resolve => setTimeout(resolve, 80))

    assert.equal(observerValues.length, 2, 'Observer should receive initial resolution and latest valid resolution')
    assert.equal(observerValues[1], 'result:v2', 'Stale slower resolution (v1-slow) must be invalidated and discarded')
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
      assert.ok(consoleErrors[0].includes('[Coralite] Async getter "data" failed:'), 'Error message contains expected prefix')

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

  it('Explicit Guard: P1.11 pre- vs post-await dependency tracking and observer notifications', async () => {
    const observerLog = []

    const options = {
      componentId: 'test-p111-guard',
      templateHTML: '<div></div>',
      defaultValues: { preKey: 'A', postKey: 'X' },
      getters: {
        async asyncGetter ({ state }) {
          const pre = state.preKey
          await new Promise(r => setTimeout(r, 15))
          const post = state.postKey
          return `res:${pre}:${post}`
        }
      },
      client ({ observe }) {
        observe('asyncGetter', (newVal, oldVal) => {
          observerLog.push({ newVal, oldVal })
        })
      }
    }

    const testTag = 'test-p111-guard'
    const ElementClass = createCoraliteClass(options)
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    await new Promise(r => setTimeout(r, 30))

    assert.equal(observerLog.length, 1, 'Initial async getter resolution delivers first notification')
    assert.deepEqual(observerLog[0], { newVal: 'res:A:X', oldVal: undefined })

    // Post-await read mutation: must NOT trigger re-evaluation or observer
    el._state.postKey = 'Y'
    await new Promise(r => setTimeout(r, 30))

    assert.equal(observerLog.length, 1, 'Post-await mutation does not trigger getter re-evaluation or observer')

    // Pre-await read mutation: MUST trigger re-evaluation and observer notification
    el._state.preKey = 'B'
    await new Promise(r => setTimeout(r, 30))

    assert.equal(observerLog.length, 2, 'Pre-await mutation triggers getter re-evaluation and observer notification')
    assert.deepEqual(observerLog[1], { newVal: 'res:B:Y', oldVal: 'res:A:X' })
  })
})
