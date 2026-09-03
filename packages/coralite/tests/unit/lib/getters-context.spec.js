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
const { createComponentDefinition } = await import('../../../lib/component-setup.js')

describe('Getters Context ({ root, refs, signal })', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('provides root in client getters context', () => {
    const options = {
      componentId: 'test-root-getter',
      getters: {
        tagName: (state, { root }) => root ? root.tagName.toLowerCase() : null,
        hasAttr: (state, { root }) => root ? root.hasAttribute('active') : false
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-root-getter'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    assert.equal(el._state.tagName, 'test-root-getter')
    assert.equal(el._state.hasAttr, false)

    el.setAttribute('active', 'true')
    assert.equal(el._state.hasAttr, true)
  })

  it('handles root methods gracefully when unconnected', () => {
    const options = {
      componentId: 'test-unconnected-getter',
      getters: {
        parentRole: (state, { root }) => {
          const parent = root?.closest?.('main')
          return parent ? 'main-child' : 'standalone'
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-unconnected-getter'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)
    // Connected to body (outside <main>), root.closest('main') returns null
    assert.equal(el._state.parentRole, 'standalone')
  })

  it('provides refs resolver in client getters context', () => {
    const options = {
      componentId: 'test-refs-getter',
      hydrationMap: {
        refs: [{ name: 'input', path: [0] }]
      },
      getters: {
        inputValue: (state, { refs }) => {
          const inputEl = refs('input')
          return inputEl ? inputEl.value : null
        },
        missingRef: (state, { refs }) => {
          return refs('nonExistent')
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-refs-getter'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    const input = document.createElement('input')
    input.value = 'hello world'
    el.appendChild(input)
    document.body.appendChild(el)

    assert.equal(el._state.inputValue, 'hello world')
    assert.equal(el._state.missingRef, null)
  })

  it('maintains async cancellation via signal in getters context', async () => {
    let capturedSignal = null
    const options = {
      componentId: 'test-signal-getter',
      getters: {
        asyncData: async (state, { signal, root, refs }) => {
          capturedSignal = signal
          assert.ok(root)
          assert.equal(typeof refs, 'function')
          return 'resolved'
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-signal-getter'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    const res = await el._state.asyncData
    assert.equal(res, 'resolved')
    assert.ok(capturedSignal)
    assert.equal(capturedSignal.aborted, false)
  })

  it('is 100% backwards compatible with 1-arg getters (state)', () => {
    const options = {
      componentId: 'test-legacy-getter',
      defaultValues: { count: 5 },
      getters: {
        doubleCount: (state) => state.count * 2
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-legacy-getter'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    assert.equal(el._state.doubleCount, 10)
  })

  it('provides SSR-safe getters context during server setup', async () => {
    const defineComp = createComponentDefinition({ app: { options: {} } })
    const context = {
      state: { value: 10 },
      module: { id: 'ssr-component', path: { pathname: '/ssr.html' } },
      root: null
    }

    const options = {
      getters: {
        computed: (state, { root, refs, signal }) => {
          assert.equal(root, null)
          assert.equal(refs('anything'), null)
          assert.ok(signal)
          return state.value * 3
        }
      }
    }

    const result = await defineComp(options, context)
    assert.equal(result.computed, 30)
  })
})
