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

describe('Signal-Backed State (P4.02)', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('reads and writes state properties through signals', async () => {
    const options = {
      componentId: 'signal-state-basic',
      attributes: {
        count: { default: 0 }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'signal-state-basic-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.equal(el._state.count, 0)

    el._state.count = 1
    assert.equal(el._state.count, 1)
    assert.equal(el._stateRaw.count, 1)

    el._state.count = 42
    assert.equal(el._state.count, 42)
    assert.equal(el._stateRaw.count, 42)
  })

  it('registers observe callbacks as signal subscribers', async () => {
    let observeCalls = 0
    let lastNewVal = null
    let lastOldVal = null

    const options = {
      componentId: 'signal-state-observe',
      attributes: {
        count: { default: 0 }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'signal-state-observe-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    el._observeStateKey('count', (newVal, oldVal) => {
      observeCalls++
      lastNewVal = newVal
      lastOldVal = oldVal
    })

    el._state.count = 5
    assert.equal(observeCalls, 1)
    assert.equal(lastNewVal, 5)
    assert.equal(lastOldVal, 0)

    el._state.count = 10
    assert.equal(observeCalls, 2)
    assert.equal(lastNewVal, 10)
    assert.equal(lastOldVal, 5)
  })

  it('re-evaluates computed getters when signal dependencies change', async () => {
    let getterEvaluations = 0

    const options = {
      componentId: 'signal-state-getter',
      attributes: {
        firstName: { default: 'Alice' },
        lastName: { default: 'Smith' }
      },
      getters: {
        fullName ({ state }) {
          getterEvaluations++
          return `${state.firstName} ${state.lastName}`
        }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'signal-state-getter-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.equal(el._state.fullName, 'Alice Smith')
    const initialEvals = getterEvaluations
    assert.ok(initialEvals >= 1)

    // Updating state signal invalidates computed getter
    el._state.firstName = 'Bob'
    assert.equal(el._state.fullName, 'Bob Smith')
  })

  it('collapses multiple synchronous writes into one DOM update flush', async () => {
    let updateCount = 0

    const options = {
      componentId: 'signal-state-batch',
      attributes: {
        a: { default: 1 },
        b: { default: 2 },
        c: { default: 3 }
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'signal-state-batch-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)
    el._updaters = {}
    el._needsDOMUpdate = true

    const originalUpdateDOM = el._updateDOM.bind(el)
    el._updateDOM = () => {
      updateCount++
      return originalUpdateDOM()
    }

    el._state.a = 10
    el._state.b = 20
    el._state.c = 30

    assert.equal(updateCount, 0, 'DOM update is batched microtask')

    await el.updateComplete

    assert.equal(updateCount, 1, 'Multiple writes collapse into one DOM flush')
    assert.equal(el._state.a, 10)
    assert.equal(el._state.b, 20)
    assert.equal(el._state.c, 30)
  })
})
