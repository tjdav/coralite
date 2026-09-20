import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass, isBooleanCustomAttribute } from '../../../lib/coralite-element.js'

describe('Boolean Custom Attribute Bindings', () => {
  it('isBooleanCustomAttribute utility tests', () => {
    const mockElement = {
      componentOptions: {
        attributes: {
          loading: Boolean,
          isActive: { type: Boolean },
          isPending: { type: 'Boolean' },
          title: String,
          count: Number
        }
      }
    }

    // Direct matches
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'loading'), true)
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'isActive'), true)
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'is-active'), true)
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'isPending'), true)
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'is-pending'), true)

    // Non-boolean attributes
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'title'), false)
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'count'), false)
    assert.strictEqual(isBooleanCustomAttribute(mockElement, 'unknown'), false)

    // Invalid elements or inputs
    assert.strictEqual(isBooleanCustomAttribute(null, 'loading'), false)
    assert.strictEqual(isBooleanCustomAttribute({}, 'loading'), false)
    assert.strictEqual(isBooleanCustomAttribute(mockElement, null), false)
  })

  it('Parent binding boolean state to child custom element with boolean schema', (t, done) => {
    const childTag = 'child-btn-' + Math.random().toString(36).substring(2, 9)
    const parentTag = 'parent-view-' + Math.random().toString(36).substring(2, 9)

    // 1. Define Child Custom Element
    const ChildComp = createCoraliteClass({
      componentId: 'child-btn',
      attributes: {
        loading: Boolean,
        isActive: { type: Boolean }
      },
      templateHTML: '<span>Child</span>'
    })
    customElements.define(childTag, ChildComp)

    // 2. Define Parent Custom Element
    const ParentComp = createCoraliteClass({
      componentId: 'parent-view',
      defaultValues: {
        isCreating: false,
        active: false,
        label: 'false'
      },
      templateHTML: `<${childTag} loading="{{ isCreating }}" is-active="{{ active }}" title="{{ label }}"></${childTag}>`,
      hydrationMap: {
        attributes: [
          {
            path: [0],
            name: 'loading',
            template: '{{ isCreating }}',
            tokens: ['isCreating'],
            isSingleToken: true,
            singleTokenKey: 'isCreating',
            attrKind: 0
          },
          {
            path: [0],
            name: 'is-active',
            template: '{{ active }}',
            tokens: ['active'],
            isSingleToken: true,
            singleTokenKey: 'active',
            attrKind: 0
          },
          {
            path: [0],
            name: 'title',
            template: '{{ label }}',
            tokens: ['label'],
            isSingleToken: true,
            singleTokenKey: 'label',
            attrKind: 0
          }
        ]
      }
    })
    customElements.define(parentTag, ParentComp)

    // 3. Instantiate Parent
    const parent = document.createElement(parentTag)
    document.body.appendChild(parent)

    queueMicrotask(() => {
      const child = parent.querySelector(childTag)
      assert.ok(child, 'Child element should be rendered')

      // Initial state: isCreating = false, active = false, label = 'false'
      // loading and is-active should NOT be set as loading="false" or is-active="false".
      // They should be removed due to boolean semantics.
      assert.strictEqual(child.hasAttribute('loading'), false)
      assert.strictEqual(child.hasAttribute('is-active'), false)

      // title is a non-boolean attribute, so it gets string semantics "false"
      assert.strictEqual(child.getAttribute('title'), 'false')

      // 4. Update Parent state to true
      // @ts-ignore
      parent._state.isCreating = true
      // @ts-ignore
      parent._state.active = true

      queueMicrotask(() => {
        // Truthy boolean attributes set attribute to empty string
        assert.strictEqual(child.hasAttribute('loading'), true)
        assert.strictEqual(child.getAttribute('loading'), '')
        assert.strictEqual(child.hasAttribute('is-active'), true)
        assert.strictEqual(child.getAttribute('is-active'), '')

        // 5. Update Parent state back to false
        // @ts-ignore
        parent._state.isCreating = false
        // @ts-ignore
        parent._state.active = false

        queueMicrotask(() => {
          // Falsy boolean attributes are removed from the DOM
          assert.strictEqual(child.hasAttribute('loading'), false)
          assert.strictEqual(child.hasAttribute('is-active'), false)

          document.body.removeChild(parent)
          done()
        })
      })
    })
  })
})
