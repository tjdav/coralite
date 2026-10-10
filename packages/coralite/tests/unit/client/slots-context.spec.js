import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { assertSame } from '../helpers.js'
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

describe('Isomorphic slots Helper Context ({ slots })', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('provides slots.has(), slots.get(), slots.count(), and slots.names in getters context', () => {
    const options = {
      componentId: 'test-slots-getter',
      templateHTML: '<div class="box"><slot name="leading"></slot><slot></slot></div>',
      getters: {
        hasDefault: ({ slots }) => slots.has('default'),
        hasLeading: ({ slots }) => slots.has('leading'),
        defaultCount: ({ slots }) => slots.count('default'),
        leadingCount: ({ slots }) => slots.count('leading'),
        slotNames: ({ slots }) => slots.names
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-slots-getter'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    const p = document.createElement('p')
    p.textContent = 'Main Content'
    el.appendChild(p)
    document.body.appendChild(el)

    assert.equal(el._state.hasDefault, true)
    assert.equal(el._state.hasLeading, false)
    assert.equal(el._state.defaultCount, 1)
    assert.equal(el._state.leadingCount, 0)
    assert.deepEqual(el._state.slotNames, ['leading', 'default'])
  })

  it('supports direct property shorthand (slots.default, slots[name]) in getters context', () => {
    const options = {
      componentId: 'test-slots-shorthand',
      templateHTML: '<div class="box"><slot name="leading"></slot><slot></slot></div>',
      getters: {
        defaultNodes: ({ slots }) => slots.default,
        leadingNodes: ({ slots }) => slots.leading
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-slots-shorthand'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    const span = document.createElement('span')
    span.textContent = 'Hello'
    el.appendChild(span)
    document.body.appendChild(el)

    assert.ok(Array.isArray(el._state.defaultNodes))
    assert.equal(el._state.defaultNodes.length, 1)
    assert.equal(el._state.defaultNodes[0], span)

    assert.ok(Array.isArray(el._state.leadingNodes))
    assert.equal(el._state.leadingNodes.length, 0)
  })

  it('filters comment nodes and empty whitespace text nodes', () => {
    const options = {
      componentId: 'test-slots-filter',
      templateHTML: '<div><slot></slot></div>',
      getters: {
        count: ({ slots }) => slots.count('default'),
        nodes: ({ slots }) => slots.get('default')
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-slots-filter'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    // Add comment node
    el.appendChild(document.createComment('test comment'))
    // Add whitespace text node
    el.appendChild(document.createTextNode('   \n  '))
    // Add valid element
    const button = document.createElement('button')
    button.textContent = 'Click'
    el.appendChild(button)
    // Add non-empty text node
    el.appendChild(document.createTextNode('Text Content'))

    document.body.appendChild(el)

    assert.equal(el._state.count, 2)
    assert.equal(el._state.nodes.length, 2)
    assert.equal(el._state.nodes[0], button)
    assert.equal(el._state.nodes[1].textContent, 'Text Content')
  })

  it('ignores default fallback content when measuring slots.has() and slots.count()', () => {
    const options = {
      componentId: 'test-slots-fallback',
      templateHTML: '<div class="box"><slot name="icon" data-coralite-fallback><span class="fb">Default Icon</span></slot></div>',
      getters: {
        hasIcon: ({ slots }) => slots.has('icon'),
        iconCount: ({ slots }) => slots.count('icon'),
        iconNodes: ({ slots }) => slots.get('icon')
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-slots-fallback'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    assert.equal(el._state.hasIcon, false)
    assert.equal(el._state.iconCount, 0)
    assert.deepEqual(el._state.iconNodes, [])
  })

  it('provides slots context inside client() execution', async () => {
    let clientSlotsResult = null

    const options = {
      componentId: 'test-slots-client',
      templateHTML: '<div><slot name="header"></slot></div>',
      client: ({ slots }) => {
        clientSlotsResult = {
          hasHeader: slots.has('header'),
          headerCount: slots.count('header'),
          headerNodes: slots.header
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-slots-client'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    const h1 = document.createElement('h1')
    h1.setAttribute('slot', 'header')
    h1.textContent = 'Title'
    el.appendChild(h1)
    document.body.appendChild(el)

    // Wait for client async init if needed
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.ok(clientSlotsResult)
    assert.equal(clientSlotsResult.hasHeader, true)
    assert.equal(clientSlotsResult.headerCount, 1)
    assert.equal(clientSlotsResult.headerNodes[0], h1)
  })

  it('provides SSR-safe slots context during server setup', async () => {
    const defineComp = createComponentDefinition({ app: { options: {} } })
    const mockRoot = {
      slots: [
        { name: 'default', node: { type: 'element', name: 'p' } },
        { name: 'default', node: { type: 'comment', data: 'comment' } },
        { name: 'default', node: { type: 'text', data: '   ' } }
      ]
    }

    const context = {
      state: {},
      module: { id: 'ssr-slots-component', path: { pathname: '/ssr.html' } },
      root: mockRoot
    }

    const options = {
      getters: {
        hasDefault: ({ slots }) => slots.has('default'),
        hasLeading: ({ slots }) => slots.has('leading'),
        count: ({ slots }) => slots.count('default'),
        names: ({ slots }) => slots.names,
        defaultNodes: ({ slots }) => slots.default
      }
    }

    const result = await defineComp(options, context)
    assert.equal(result.hasDefault, true)
    assert.equal(result.hasLeading, false)
    assert.equal(result.count, 1)
    assert.deepEqual(result.names, ['default'])
    assert.equal(result.defaultNodes.length, 1)
  })

  it('reuses slots helper proxy and context object identity across multiple getter evaluations', () => {
    let capturedContext1 = null
    let capturedContext2 = null

    const options = {
      componentId: 'test-cache-identity',
      templateHTML: '<div><slot></slot></div>',
      defaultValues: { count: 0 },
      getters: {
        myGetter: (ctx) => {
          if (!capturedContext1) {
            capturedContext1 = ctx
          } else {
            capturedContext2 = ctx
          }
          return ctx.state.count * 2
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-cache-identity'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    const val1 = el._state.myGetter
    assert.equal(val1, 0)

    el._state.count = 5
    const val2 = el._state.myGetter
    assert.equal(val2, 10)

    assert.ok(capturedContext1)
    assert.ok(capturedContext2)
    assert.equal(capturedContext1, capturedContext2)
    assert.equal(capturedContext1.slots, capturedContext2.slots)
    assert.equal(capturedContext1.slots, el._getSlotsHelper())
  })

  it('updates context.signal with fresh active AbortSignal while aborting the previous signal on repeated getter evaluation', () => {
    let firstSignal = null
    let secondSignal = null

    const options = {
      componentId: 'test-signal-update',
      defaultValues: { val: 1 },
      getters: {
        sigGetter: (ctx) => {
          if (!firstSignal) {
            firstSignal = ctx.signal
          } else {
            secondSignal = ctx.signal
          }
          return ctx.state.val + 10
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-signal-update'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    assert.equal(el._state.sigGetter, 11)
    assert.equal(firstSignal.aborted, false)

    el._state.val = 2
    assert.equal(el._state.sigGetter, 12)

    assert.equal(firstSignal.aborted, true)
    assert.notEqual(firstSignal, secondSignal)
    assert.equal(secondSignal.aborted, false)
  })

  it('preserves cached slots helper and getter contexts during synchronous DOM reparenting', () => {
    const options = {
      componentId: 'test-reparenting-cache',
      templateHTML: '<div><slot></slot></div>',
      getters: {
        info: (ctx) => ctx.slots.count('default')
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-reparenting-cache'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    // Trigger getter evaluation to populate caches
    assert.equal(el._state.info, 0)
    const slotsHelperBefore = el._getSlotsHelper()
    const getterContextsBefore = el._getterContexts

    assert.ok(slotsHelperBefore)
    assert.ok(getterContextsBefore)

    // Synchronous reparenting
    const container = document.createElement('div')
    document.body.appendChild(container)
    document.body.removeChild(el)
    container.appendChild(el)

    assert.equal(el._slotsHelper, slotsHelperBefore)
    assert.equal(el._getterContexts, getterContextsBefore)
    assert.equal(el._state.info, 0)
  })

  it('clears caches on genuine disconnect microtask and cleanly re-initializes upon re-attachment', async () => {
    const options = {
      componentId: 'test-teardown-reconnect',
      templateHTML: '<div><slot></slot></div>',
      getters: {
        valGetter: (ctx) => ctx.slots.has('default')
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-teardown-reconnect'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    assert.equal(el._state.valGetter, false)
    const oldSlotsHelper = el._slotsHelper
    const oldGetterContexts = el._getterContexts
    assert.ok(oldSlotsHelper)
    assert.ok(oldGetterContexts)

    // Detach and wait for microtask turn
    document.body.removeChild(el)
    await Promise.resolve()

    assert.equal(el._slotsHelper, null)
    assert.equal(el._getterContexts, null)

    // Re-attach to DOM and verify clean re-initialization
    const p = document.createElement('p')
    el.appendChild(p)
    document.body.appendChild(el)

    assert.equal(el._state.valGetter, true)
    assert.ok(el._slotsHelper)
    assert.notEqual(el._slotsHelper, oldSlotsHelper)
    assert.ok(el._getterContexts)
    assert.notEqual(el._getterContexts, oldGetterContexts)
  })

  it('dynamically queries live DOM changes through cached slots helper without staling', () => {
    let capturedSlots = null

    const options = {
      componentId: 'test-live-slots-query',
      templateHTML: '<div><slot></slot></div>',
      getters: {
        itemCount: ({ slots }) => {
          capturedSlots = slots
          return slots.count('default')
        }
      }
    }

    const ElementClass = createCoraliteClass(options)
    const testTag = 'test-live-slots-query'
    if (!customElements.get(testTag)) {
      customElements.define(testTag, ElementClass)
    }

    const el = document.createElement(testTag)
    document.body.appendChild(el)

    assert.equal(el._state.itemCount, 0)
    assert.equal(capturedSlots.count('default'), 0)
    assert.equal(capturedSlots.has('default'), false)

    // Add slotted child element dynamically
    const child1 = document.createElement('div')
    child1.textContent = 'Child 1'
    el.appendChild(child1)
    el._reconcileLightDOM()

    assert.equal(capturedSlots.count('default'), 1)
    assert.equal(capturedSlots.has('default'), true)
    assert.equal(capturedSlots.get('default')[0], child1)

    // Add another slotted child element dynamically
    const child2 = document.createElement('div')
    child2.textContent = 'Child 2'
    el.appendChild(child2)
    el._reconcileLightDOM()

    assert.equal(capturedSlots.count('default'), 2)
    assert.equal(capturedSlots.get('default')[1], child2)

    // Remove first child element from target slot
    const targetSlot = el._getOwnSlots().find(s => (s.getAttribute('name') || 'default') === 'default')
    if (targetSlot && child1.parentNode === targetSlot) {
      targetSlot.removeChild(child1)
    } else if (child1.parentNode === el) {
      el.removeChild(child1)
    }
    assert.equal(capturedSlots.count('default'), 1)
    assert.equal(capturedSlots.get('default')[0], child2)
  })

  it('invalidates stale own-slot cache and emits dev/test console.warn when cached slot is detached', () => {
    const warnings = []
    const originalWarn = console.warn
    console.warn = (...args) => {
      warnings.push(args.join(' '))
    }

    try {
      const options = {
        componentId: 'test-stale-own-slots',
        templateHTML: '<div class="wrapper"><slot></slot></div>'
      }

      const ElementClass = createCoraliteClass(options)
      const testTag = 'test-stale-own-slots'
      if (!customElements.get(testTag)) {
        customElements.define(testTag, ElementClass)
      }

      const el = document.createElement(testTag)
      document.body.appendChild(el)

      // Initial call populates _cachedOwnSlots
      const initialSlots = el._getOwnSlots()
      assert.equal(initialSlots.length, 1)
      assertSame(el._cachedOwnSlots, initialSlots)

      // Simulate wiping host content or detaching the slot
      el.innerHTML = ''
      assert.equal(initialSlots[0].isConnected, false)

      // Next call to _getOwnSlots should detect stale cache, warn, and re-evaluate
      const updatedSlots = el._getOwnSlots()
      assert.equal(updatedSlots.length, 0)
      assert.equal(warnings.length, 1)
      assert.ok(warnings[0].includes('Stale slot cache detected for component "test-stale-own-slots"'))

      // Second stale detection on the same instance must not warn again (warn-once guard)
      const recachedSlot = document.createElement('slot')
      el.appendChild(recachedSlot)
      // The invalidated cache is now an empty array, which is treated as valid
      // until explicitly cleared, so reset it to re-exercise the stale path
      el._cachedOwnSlots = null
      const recachedSlots = el._getOwnSlots()
      assert.equal(recachedSlots.length, 1)
      assertSame(el._cachedOwnSlots, recachedSlots)

      el.innerHTML = ''
      assert.equal(recachedSlots[0].isConnected, false)
      el._getOwnSlots()
      assert.equal(warnings.length, 1)

      // Adding new child node now stays as direct child instead of appending to detached slot
      const child = document.createElement('p')
      child.textContent = 'Fallback child'
      el.appendChild(child)
      el._reconcileLightDOM()

      assertSame(child.parentNode, el)
    } finally {
      console.warn = originalWarn
    }
  })
})
