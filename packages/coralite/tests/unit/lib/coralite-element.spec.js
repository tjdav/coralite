import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'

describe('CoraliteElement', () => {
  let MyElement
  let tagName

  beforeEach(() => {
    tagName = 'my-comp-' + Math.random().toString(36).substring(2, 9)
    const options = {
      componentId: 'my-comp',
      templateHTML: '<div><span id="text">{{ message }}</span><input id="input" value="{{ message }}"></div>',
      defaultValues: { message: 'hello' },
      attributes: {
        count: { type: Number }
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ message }}'
          }
        ],
        attributes: [
          {
            path: [0, 1],
            name: 'value',
            template: '{{ message }}'
          }
        ]
      }
    }

    MyElement = createCoraliteClass(options)
    customElements.define(tagName, MyElement)
  })

  it('should initialize with default values', () => {
    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.strictEqual(el.querySelector('#text').textContent, 'hello')
    assert.strictEqual(el.querySelector('#input').value, 'hello')

    document.body.removeChild(el)
  })

  it('should react to state changes', (t, done) => {
    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // @ts-ignore
    el._state.message = 'world'

    queueMicrotask(() => {
      assert.strictEqual(el.querySelector('#text').textContent, 'world')
      assert.strictEqual(el.querySelector('#input').value, 'world')
      document.body.removeChild(el)
      done()
    })
  })

  it('should handle attribute changes', (t, done) => {
    const el = document.createElement(tagName)
    el.setAttribute('count', '123')
    document.body.appendChild(el)

    // @ts-ignore
    assert.strictEqual(el._state.count, 123)

    el.setAttribute('count', '456')

    queueMicrotask(() => {
      // @ts-ignore
      assert.strictEqual(el._state.count, 456)
      document.body.removeChild(el)
      done()
    })
  })

  it('should handle imperative creation with innerHTML', () => {
    const el = document.createElement(tagName)
    el.innerHTML = '<span slot="default">projected</span>'
    document.body.appendChild(el)

    // Since it's imperative, connectedCallback stamps templateHTML if available
    // and projects Light DOM.
    // templateHTML in beforeEach has a <div> but no <slot>.
    // Let's redefine MyElement with a slot for this test.
    const slotTagName = 'comp-slot-' + Math.random().toString(36).substring(2, 9)
    const optionsWithSlot = {
      componentId: 'comp-slot',
      templateHTML: '<div><slot></slot></div>'
    }
    const SlotElement = createCoraliteClass(optionsWithSlot)
    customElements.define(slotTagName, SlotElement)

    const el2 = document.createElement(slotTagName)
    el2.innerHTML = '<span>projected</span>'
    document.body.appendChild(el2)

    assert.ok(el2.innerHTML.includes('projected'))
    document.body.removeChild(el2)
    document.body.removeChild(el)
  })

  it('should call disconnected hooks', () => {
    let called = false
    const hookTagName = 'hook-comp-' + Math.random().toString(36).substring(2, 9)
    const HookElement = createCoraliteClass({ componentId: 'hook-comp' }, null, {
      onDisconnected: [() => {
        called = true
      }]
    })
    customElements.define(hookTagName, HookElement)

    const el = document.createElement(hookTagName)
    document.body.appendChild(el)
    document.body.removeChild(el)

    assert.strictEqual(called, true)
  })

  it('should support shorthand and longhand attribute types and default values', () => {
    const attrTagName = 'attr-comp-' + Math.random().toString(36).substring(2, 9)
    const AttrElement = createCoraliteClass({
      componentId: 'attr-comp',
      defaultValues: {
        active: true,
        maxItems: 10,
        theme: 'dark'
      },
      attributes: {
        // Boolean
        visible: Boolean,
        active: {
          type: Boolean,
          default: true
        },

        // Number
        count: Number,
        maxItems: {
          type: Number,
          default: 10
        },

        // String
        titleText: String,
        theme: {
          type: String,
          default: 'dark'
        }
      }
    })
    customElements.define(attrTagName, AttrElement)

    const el = document.createElement(attrTagName)
    document.body.appendChild(el)

    // Check initial values / defaults
    // @ts-ignore
    assert.strictEqual(el._state.visible, undefined)
    // @ts-ignore
    assert.strictEqual(el._state.active, true)
    // @ts-ignore
    assert.strictEqual(el._state.count, undefined)
    // @ts-ignore
    assert.strictEqual(el._state.maxItems, 10)
    // @ts-ignore
    assert.strictEqual(el._state.titleText, undefined)
    // @ts-ignore
    assert.strictEqual(el._state.theme, 'dark')

    // Set attributes on the DOM
    el.setAttribute('visible', '')
    el.setAttribute('active', 'false')
    el.setAttribute('count', '42')
    el.setAttribute('max-items', '20')
    el.setAttribute('title-text', 'hello')
    el.setAttribute('theme', 'light')

    // Check coerced values after DOM attributes updates
    // @ts-ignore
    assert.strictEqual(el._state.visible, true)
    // @ts-ignore
    assert.strictEqual(el._state.active, false)
    // @ts-ignore
    assert.strictEqual(el._state.count, 42)
    // @ts-ignore
    assert.strictEqual(el._state.maxItems, 20)
    // @ts-ignore
    assert.strictEqual(el._state.titleText, 'hello')
    // @ts-ignore
    assert.strictEqual(el._state.theme, 'light')

    document.body.removeChild(el)
  })

  it('should toggle native boolean attributes by adding/removing them, and keep non-native attributes as strings', (t, done) => {
    const toggleTagName = 'toggle-comp-' + Math.random().toString(36).substring(2, 9)
    const ToggleElement = createCoraliteClass({
      componentId: 'toggle-comp',
      templateHTML: '<div><button id="btn" disabled="{{ isDisabled }}">Btn</button><span id="span" active="{{ isActive }}">Span</span></div>',
      defaultValues: {
        isDisabled: false,
        isActive: false
      },
      hydrationMap: {
        attributes: [
          {
            path: [0, 0],
            name: 'disabled',
            template: '{{ isDisabled }}'
          },
          {
            path: [0, 1],
            name: 'active',
            template: '{{ isActive }}'
          }
        ]
      }
    })
    customElements.define(toggleTagName, ToggleElement)

    const el = document.createElement(toggleTagName)
    document.body.appendChild(el)

    const btn = el.querySelector('#btn')
    const span = el.querySelector('#span')

    // Initially falsy, so native 'disabled' should be removed, while non-native 'active' is set to falsy string
    assert.strictEqual(btn.hasAttribute('disabled'), false)
    assert.strictEqual(span.getAttribute('active'), 'false')

    // Change to truthy
    // @ts-ignore
    el._state.isDisabled = true
    // @ts-ignore
    el._state.isActive = true

    queueMicrotask(() => {
      // Button disabled should be set to empty string, span active to true
      assert.strictEqual(btn.getAttribute('disabled'), '')
      assert.strictEqual(span.getAttribute('active'), 'true')

      // Change back to falsy
      // @ts-ignore
      el._state.isDisabled = false
      // @ts-ignore
      el._state.isActive = false

      queueMicrotask(() => {
        // Button disabled should be completely removed, span active should be set to string 'false'
        assert.strictEqual(btn.hasAttribute('disabled'), false)
        assert.strictEqual(span.getAttribute('active'), 'false')

        document.body.removeChild(el)
        done()
      })
    })
  })
})
