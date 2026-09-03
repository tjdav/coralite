import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { shouldReflectAttribute } from '../../../lib/utils/attributes.js'

describe('Hybrid Attribute Reflection Strategy', () => {
  it('shouldReflectAttribute utility logic', () => {
    assert.strictEqual(shouldReflectAttribute(Boolean), true)
    assert.strictEqual(shouldReflectAttribute({ type: Boolean }), true)
    assert.strictEqual(shouldReflectAttribute({ type: 'Boolean' }), true)
    assert.strictEqual(shouldReflectAttribute({ values: [true, false] }), true)
    assert.strictEqual(shouldReflectAttribute({ type: Boolean, reflect: false }), false)

    assert.strictEqual(shouldReflectAttribute(String), false)
    assert.strictEqual(shouldReflectAttribute(Number), false)
    assert.strictEqual(shouldReflectAttribute({ type: String }), false)
    assert.strictEqual(shouldReflectAttribute({ values: ['a', 'b'] }), false)
    assert.strictEqual(shouldReflectAttribute({ type: String, reflect: true }), true)
    assert.strictEqual(shouldReflectAttribute({ type: Number, reflect: true }), true)
  })

  it('1. Boolean Default Reflection (reflect: true default)', (t, done) => {
    const tagName = 'reflect-bool-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 'reflect-bool',
      attributes: {
        disabled: Boolean,
        open: { type: Boolean }
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Initial mount: Host DOM attributes are clean without injected defaults
    assert.strictEqual(el.hasAttribute('disabled'), false)
    assert.strictEqual(el.hasAttribute('open'), false)

    // Runtime state mutation -> reflect to host attribute
    // @ts-ignore
    el._state.disabled = true
    assert.strictEqual(el.hasAttribute('disabled'), true)
    assert.strictEqual(el.getAttribute('disabled'), '')

    // Set false -> remove host attribute
    // @ts-ignore
    el._state.disabled = false
    assert.strictEqual(el.hasAttribute('disabled'), false)

    // Set open via host property
    // @ts-ignore
    el.open = true
    assert.strictEqual(el.hasAttribute('open'), true)
    assert.strictEqual(el.getAttribute('open'), '')
    // @ts-ignore
    assert.strictEqual(el._state.open, true)

    // Set open to false via host property
    // @ts-ignore
    el.open = false
    assert.strictEqual(el.hasAttribute('open'), false)
    // @ts-ignore
    assert.strictEqual(el._state.open, false)

    document.body.removeChild(el)
    done()
  })

  it('2. Boolean Opt-Out (reflect: false)', (t, done) => {
    const tagName = 'bool-optout-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 'bool-optout',
      attributes: {
        internalFlag: {
          type: Boolean,
          reflect: false
        }
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // @ts-ignore
    el._state.internalFlag = true
    // State is updated
    // @ts-ignore
    assert.strictEqual(el._state.internalFlag, true)
    // Host DOM attribute is NOT modified
    assert.strictEqual(el.hasAttribute('internal-flag'), false)

    // @ts-ignore
    el.internalFlag = false
    // @ts-ignore
    assert.strictEqual(el._state.internalFlag, false)
    assert.strictEqual(el.hasAttribute('internal-flag'), false)

    document.body.removeChild(el)
    done()
  })

  it('3. Non-Boolean Default Non-Reflection (reflect: false default)', (t, done) => {
    const tagName = 'nonbool-noreflect-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 'nonbool-noreflect',
      attributes: {
        value: String,
        count: Number
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // @ts-ignore
    el._state.value = 'hello'
    // @ts-ignore
    el._state.count = 42

    // State updated
    // @ts-ignore
    assert.strictEqual(el._state.value, 'hello')
    // @ts-ignore
    assert.strictEqual(el._state.count, 42)

    // Host attributes NOT updated by default
    assert.strictEqual(el.hasAttribute('value'), false)
    assert.strictEqual(el.hasAttribute('count'), false)

    document.body.removeChild(el)
    done()
  })

  it('4. Non-Boolean Explicit Opt-In (reflect: true)', (t, done) => {
    const tagName = 'nonbool-reflect-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 'nonbool-reflect',
      attributes: {
        size: {
          type: String,
          reflect: true
        },
        maxItems: {
          type: Number,
          reflect: true
        }
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Setting string value -> setAttribute('size', 'lg')
    // @ts-ignore
    el._state.size = 'lg'
    assert.strictEqual(el.getAttribute('size'), 'lg')

    // Setting empty string -> setAttribute('size', '')
    // @ts-ignore
    el._state.size = ''
    assert.strictEqual(el.hasAttribute('size'), true)
    assert.strictEqual(el.getAttribute('size'), '')

    // Setting null -> removeAttribute('size')
    // @ts-ignore
    el._state.size = null
    assert.strictEqual(el.hasAttribute('size'), false)

    // Setting number value -> setAttribute('max-items', '10')
    // @ts-ignore
    el.maxItems = 10
    assert.strictEqual(el.getAttribute('max-items'), '10')

    // Property deletion -> removeAttribute('max-items')
    // @ts-ignore
    delete el._state.maxItems
    assert.strictEqual(el.hasAttribute('max-items'), false)

    document.body.removeChild(el)
    done()
  })

  it('5. Host Property Accessors (el[camelName]) & Reservation Blacklist', (t, done) => {
    const tagName = 'prop-accessors-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 'prop-accessors',
      attributes: {
        maxCount: {
          type: Number,
          reflect: true
        },
        disabled: Boolean,
        tagName: String // Reserved DOM property name
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Accessor definition check
    // @ts-ignore
    assert.strictEqual(el.maxCount, undefined)
    // Setter coercion check: setting string '25' coerces via pipeline to Number 25
    // @ts-ignore
    el.maxCount = '25'
    // @ts-ignore
    assert.strictEqual(el.maxCount, 25)
    // @ts-ignore
    assert.strictEqual(el._state.maxCount, 25)
    assert.strictEqual(el.getAttribute('max-count'), '25')

    // Boolean host accessor
    // @ts-ignore
    assert.strictEqual(el.disabled, undefined)
    // @ts-ignore
    el.disabled = 'true'
    // @ts-ignore
    assert.strictEqual(el.disabled, true)
    assert.strictEqual(el.hasAttribute('disabled'), true)

    // Reserved property blacklist check: el.tagName is NOT overwritten with custom accessor
    assert.strictEqual(el.tagName.toLowerCase(), tagName)

    document.body.removeChild(el)
    done()
  })

  it('6. Bidirectional Loop Prevention', (t, done) => {
    const tagName = 'loop-prevent-' + Math.random().toString(36).substring(2, 9)
    let stateMutations = 0

    const Comp = createCoraliteClass({
      componentId: 'loop-prevent',
      attributes: {
        open: {
          type: Boolean,
          reflect: true
        }
      },
      client ({ observe }) {
        observe('open', () => {
          stateMutations++
        })
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    queueMicrotask(() => {
      stateMutations = 0

      // DOM attribute change -> attributeChangedCallback -> state
      el.setAttribute('open', '')

      // State mutation -> proxy set trap -> setAttribute
      // @ts-ignore
      el.open = false

      queueMicrotask(() => {
        // Assert no infinite loop occurred and observer executed deterministically
        assert.strictEqual(el.hasAttribute('open'), false)
        // @ts-ignore
        assert.strictEqual(el.open, false)

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('7. Validation Error Behavior on Reflection', (t, done) => {
    const tagName = 'val-error-reflect-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 'val-error-reflect',
      attributes: {
        size: {
          values: ['sm', 'lg'],
          reflect: true
        }
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Assign invalid value
    // @ts-ignore
    el.size = 'huge'

    // Errors map populated
    // @ts-ignore
    assert.ok(el._state.errors.size)
    // State receives assigned value
    // @ts-ignore
    assert.strictEqual(el.size, 'huge')
    // Host attribute reflects assigned value String(v) for DevTools & native inspection
    assert.strictEqual(el.getAttribute('size'), 'huge')

    // Assign valid value to recover
    // @ts-ignore
    el.size = 'lg'
    // @ts-ignore
    assert.strictEqual(el._state.errors.size, undefined)
    assert.strictEqual(el.getAttribute('size'), 'lg')

    document.body.removeChild(el)
    done()
  })
})
