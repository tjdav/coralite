/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { generateClientRuntime } from '#lib/client/utils/runtime.js'

describe('Hydration Ordering & Merge Semantics (E2E-3)', () => {
  beforeEach(() => {
    delete window.__coralite__
  })

  it('server hydration data survives shared-chunk initialization', () => {
    // Step 1: Inline runtime script runs before async imports
    window.__coralite__ = {
      state: {},
      config: {}
    }
    window.__coralite__.state.hydration = Object.assign(
      {},
      window.__coralite__.state.hydration || {},
      { user: { id: 1 } }
    )

    // Step 2: Shared chunk loads during await Promise.all and executes top-level init
    window.__coralite__.state.hydration = window.__coralite__.state.hydration || {}

    // Assert server data is preserved and not dropped
    assert.ok(window.__coralite__.state.hydration.user)
    assert.equal(window.__coralite__.state.hydration.user.id, 1)
  })

  it('pre-existing hydration data merges, server data wins', () => {
    // Simulate pre-existing hydration data
    window.__coralite__ = { state: { hydration: { user: { id: 1 } } } }

    // Inline runtime script runs Object.assign with server data
    window.__coralite__.state.hydration = Object.assign(
      {},
      window.__coralite__.state.hydration || {},
      { user: { id: 2 } }
    )

    // Assert server data wins
    assert.equal(window.__coralite__.state.hydration.user.id, 2)
  })

  it('instance counters merge correctly', () => {
    // Pre-existing counter
    window.__coralite__ = { state: { counters: { foo: 5 } } }

    // Inline runtime script merges new instance counters
    window.__coralite__.state.counters = Object.assign(
      {},
      window.__coralite__.state.counters || {},
      { bar: 10 }
    )

    // Both keys present
    assert.deepEqual(window.__coralite__.state.counters, {
      foo: 5,
      bar: 10
    })
  })

  it('generateClientRuntime places Object.assign calls before await Promise.all', () => {
    const code = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'coralite-runtime.js',
      hydrationData: JSON.stringify({ user: { id: 100 } }),
      instanceCounters: JSON.stringify({ 'my-comp': 1 }),
      pageConfig: 'null'
    })

    const hydrationAssignIdx = code.indexOf('coralite.state.hydration = Object.assign(')
    const countersAssignIdx = code.indexOf('coralite.state.counters = Object.assign(')
    const pageConfigAssignIdx = code.indexOf('coralite.config.page = Object.assign(')
    const promiseAllIdx = code.indexOf('await Promise.all([')

    assert.notEqual(hydrationAssignIdx, -1, 'coralite.state.hydration Object.assign should be found')
    assert.notEqual(countersAssignIdx, -1, 'coralite.state.counters Object.assign should be found')
    assert.notEqual(pageConfigAssignIdx, -1, 'coralite.config.page Object.assign should be found')
    assert.notEqual(promiseAllIdx, -1, 'await Promise.all should be found')

    assert.ok(countersAssignIdx < promiseAllIdx, 'instanceCounters Object.assign must appear before await Promise.all')
    assert.ok(hydrationAssignIdx < promiseAllIdx, 'hydrationData Object.assign must appear before await Promise.all')
    assert.ok(pageConfigAssignIdx < promiseAllIdx, 'pageConfig Object.assign must appear before await Promise.all')
  })
})
