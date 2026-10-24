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

describe('Slot re-attachment getter cache invalidation (FIX-D3)', () => {
  beforeEach(() => {
    window.document.body.innerHTML = ''
  })

  it('slots.has reflects new content after reattach', async () => {
    const options = {
      componentId: 'test-slot-reconnect-1',
      templateHTML: '<div><slot></slot></div>',
      getters: {
        hasContent: (ctx) => ctx.slots.has('default')
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'test-slot-rec-1-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.strictEqual(el._state.hasContent, false, 'Initial state without slot content should return false')

    document.body.removeChild(el)

    const p = document.createElement('p')
    p.textContent = 'Slotted text'
    el.appendChild(p)

    document.body.appendChild(el)

    assert.strictEqual(el._state.hasContent, true, 'After reattaching with slot content, getter should return true')
  })

  it('slots.has reflects unchanged content after reattach', async () => {
    const options = {
      componentId: 'test-slot-reconnect-2',
      templateHTML: '<div><slot></slot></div>',
      getters: {
        hasContent: (ctx) => ctx.slots.has('default')
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'test-slot-rec-2-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    const p = document.createElement('p')
    p.textContent = 'Initial Slotted Text'
    el.appendChild(p)
    document.body.appendChild(el)

    assert.strictEqual(el._state.hasContent, true, 'Initial state with slot content should return true')

    document.body.removeChild(el)
    document.body.appendChild(el)

    assert.strictEqual(el._state.hasContent, true, 'Getter value remains true after reattaching with same content')
  })

  it('multiple detach/reattach cycles keep cache fresh', async () => {
    const options = {
      componentId: 'test-slot-reconnect-3',
      templateHTML: '<div><slot></slot></div>',
      getters: {
        hasContent: (ctx) => ctx.slots.has('default')
      }
    }

    const CompClass = createCoraliteClass(options)
    const tagName = 'test-slot-rec-3-' + Math.random().toString(36).slice(2, 8)
    customElements.define(tagName, CompClass)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.strictEqual(el._state.hasContent, false, 'Cycle 0: empty')

    // Cycle 1: add content
    document.body.removeChild(el)
    const p1 = document.createElement('p')
    p1.textContent = 'Content 1'
    el.appendChild(p1)
    document.body.appendChild(el)
    assert.strictEqual(el._state.hasContent, true, 'Cycle 1: has content')

    // Cycle 2: remove slotted element
    document.body.removeChild(el)
    p1.remove()
    document.body.appendChild(el)
    assert.strictEqual(el._state.hasContent, false, 'Cycle 2: empty after removing slotted element')

    // Cycle 3: add content back
    document.body.removeChild(el)
    const p2 = document.createElement('span')
    p2.textContent = 'Content 2'
    el.appendChild(p2)
    document.body.appendChild(el)
    assert.strictEqual(el._state.hasContent, true, 'Cycle 3: has content again')
  })
})
