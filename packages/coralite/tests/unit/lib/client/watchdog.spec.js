/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
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

const { createCoraliteClass } = await import('../../../../lib/client/element.js')

describe('Reactive Loop Watchdog (FIX-D1)', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('infinite microtask mutation loop is capped', async () => {
    const options = {
      componentId: 'watchdog-capped',
      attributes: {
        count: { default: 0 }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'watchdog-capped-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    let fireCount = 0

    el._observeStateKey('count', (newVal) => {
      fireCount++
      if (fireCount < 10000) {
        queueMicrotask(() => {
          el._state.count = newVal + 1
        })
      }
    })

    const startTime = Date.now()
    el._state.count = 1

    // Wait 200ms for microtasks to settle
    await new Promise((resolve) => setTimeout(resolve, 200))

    const elapsed = Date.now() - startTime
    assert.ok(elapsed < 1000, `Test completed in ${elapsed}ms (< 1000ms)`)
    assert.ok(fireCount <= 250, `Fire count (${fireCount}) capped near 2x threshold (<= 250)`)
    assert.ok(fireCount > 0, `Observer fired at least once (${fireCount})`)
  })

  it('legitimate single mutation still fires observer', async () => {
    const options = {
      componentId: 'watchdog-single',
      attributes: {
        x: { default: 0 }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'watchdog-single-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    let callCount = 0
    let lastVal = null

    el._observeStateKey('x', (newVal) => {
      callCount++
      lastVal = newVal
    })

    el._state.x = 1
    await new Promise((resolve) => queueMicrotask(resolve))

    assert.equal(callCount, 1)
    assert.equal(lastVal, 1)
  })

  it('legitimate microtask mutation still fires observer', async () => {
    const options = {
      componentId: 'watchdog-microtask',
      attributes: {
        x: { default: 0 }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'watchdog-microtask-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    let callCount = 0
    let lastVal = null

    el._observeStateKey('x', (newVal) => {
      callCount++
      lastVal = newVal
    })

    queueMicrotask(() => {
      el._state.x = 1
    })

    await new Promise((resolve) => queueMicrotask(resolve))
    await new Promise((resolve) => queueMicrotask(resolve))

    assert.equal(callCount, 1)
    assert.equal(lastVal, 1)
  })

  it('bounded loop (3 iterations) works normally', async () => {
    const options = {
      componentId: 'watchdog-bounded',
      attributes: {
        count: { default: 0 }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'watchdog-bounded-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    let callCount = 0

    el._observeStateKey('count', (newVal) => {
      callCount++
      if (newVal < 3) {
        queueMicrotask(() => {
          el._state.count = newVal + 1
        })
      }
    })

    el._state.count = 1

    // Allow bounded microtask hops to process
    await new Promise((resolve) => setTimeout(resolve, 50))

    assert.equal(callCount, 3)
    assert.equal(el._state.count, 3)
  })
})
