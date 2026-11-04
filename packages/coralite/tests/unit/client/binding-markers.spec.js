import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createCoraliteClass } from '../../../lib/client/element.js'

const nextTag = () => `marker-test-${Math.random().toString(36).slice(2, 9)}`

const define = (tag, options) => {
  const ElementClass = createCoraliteClass(options)
  customElements.define(tag, ElementClass)
  return ElementClass
}

describe('binding marker resolution', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window['__coralite__'] = {
      mode: 'testing'
    }
  })

  it('resolves text and attribute bindings by marker instead of slot indices', async () => {
    const tag = nextTag()
    const componentId = 'marker-parent'
    const instanceId = `${componentId}-0`

    document.body.innerHTML = `<${tag} data-cid="${instanceId}" data-coralite-initial>
      <div class="wrapper">
        <button aria-pressed="false" data-coralite-bind="b1" data-coralite-bind-owner="${instanceId}">
          <c-token data-coralite-bind="b0" data-coralite-bind-owner="${instanceId}">off</c-token>
        </button>
        <p hidden data-coralite-bind="b3" data-coralite-bind-owner="${instanceId}">
          <c-token data-coralite-bind="b2" data-coralite-bind-owner="${instanceId}">idle</c-token>
        </p>
        <slot name="extra" data-coralite-bind="s0" data-coralite-bind-owner="${instanceId}">
          <div data-coralite-slot-index="0" data-coralite-bind="b0" data-coralite-bind-owner="marker-child-0">slotted</div>
        </slot>
      </div>
    </${tag}>`

    define(tag, {
      componentId,
      defaultValues: {
        pressed: false,
        label: 'off',
        hidden: true,
        status: 'idle'
      },
      hydrationMap: {
        version: 2,
        texts: [
          {
            id: 'b0',
            path: [1, 1, 0],
            template: '{{ label }}',
            tokens: ['label'],
            isSingleToken: true,
            singleTokenKey: 'label'
          },
          {
            id: 'b2',
            path: [1, 3, 0],
            template: '{{ status }}',
            tokens: ['status'],
            isSingleToken: true,
            singleTokenKey: 'status'
          }
        ],
        attributes: [
          {
            id: 'b1',
            type: 'attribute',
            path: [1, 1],
            name: 'aria-pressed',
            template: '{{ pressed }}',
            tokens: ['pressed'],
            isSingleToken: true,
            singleTokenKey: 'pressed',
            attrKind: 2
          },
          {
            id: 'b3',
            type: 'attribute',
            path: [1, 3],
            name: 'hidden',
            template: '{{ hidden }}',
            tokens: ['hidden'],
            isSingleToken: true,
            singleTokenKey: 'hidden',
            attrKind: 1
          }
        ],
        refs: [],
        slots: [{
          id: 's0',
          name: 'extra',
          path: [1, 5]
        }]
      }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(el.querySelector('button c-token').textContent, 'off')
    assert.equal(el.querySelector('button').getAttribute('aria-pressed'), 'false')
    assert.equal(el.querySelector('p c-token').textContent, 'idle')
    assert.equal(el.querySelector('p').hasAttribute('hidden'), true)

    el._state.label = 'on'
    el._state.pressed = true
    el._state.hidden = false
    el._state.status = 'active'

    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(el.querySelector('button c-token').textContent, 'on')
    assert.equal(el.querySelector('button').getAttribute('aria-pressed'), 'true')
    assert.equal(el.querySelector('p c-token').textContent, 'active')
    assert.equal(el.querySelector('p').hasAttribute('hidden'), false)

    assert.equal(el.querySelector('slot [data-coralite-bind-owner="marker-child-0"]').textContent, 'slotted', 'child-owned marker must not be claimed by the parent')
  })

  it('supports multiple binding IDs on the same element', async () => {
    const tag = nextTag()
    const componentId = 'marker-multi'
    const instanceId = `${componentId}-0`

    document.body.innerHTML = `<${tag} data-cid="${instanceId}" data-coralite-initial>
      <button data-coralite-bind="b0 b1" data-coralite-bind-owner="${instanceId}">Go</button>
    </${tag}>`

    define(tag, {
      componentId,
      defaultValues: {
        pressed: false,
        disabled: false
      },
      hydrationMap: {
        version: 2,
        texts: [],
        attributes: [
          {
            id: 'b0',
            type: 'attribute',
            name: 'aria-pressed',
            template: '{{ pressed }}',
            tokens: ['pressed'],
            isSingleToken: true,
            singleTokenKey: 'pressed',
            attrKind: 2
          },
          {
            id: 'b1',
            type: 'attribute',
            name: 'aria-disabled',
            template: '{{ disabled }}',
            tokens: ['disabled'],
            isSingleToken: true,
            singleTokenKey: 'disabled',
            attrKind: 2
          }
        ],
        refs: [],
        slots: []
      }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))

    const button = el.querySelector('button')
    assert.equal(button.getAttribute('aria-pressed'), 'false')
    assert.equal(button.getAttribute('aria-disabled'), 'false')

    el._state.pressed = true
    el._state.disabled = true

    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(button.getAttribute('aria-pressed'), 'true')
    assert.equal(button.getAttribute('aria-disabled'), 'true')
  })

  it('resolves refs by marker and keeps the ref attribute stable', async () => {
    const tag = nextTag()
    const componentId = 'marker-ref'
    const instanceId = `${componentId}-0`
    let clicked = false

    document.body.innerHTML = `<${tag} data-cid="${instanceId}" data-coralite-initial>
      <button data-coralite-bind="r0" data-coralite-bind-owner="${instanceId}">Click</button>
    </${tag}>`

    define(tag, {
      componentId,
      defaultValues: {},
      client ({ refs, signal }) {
        refs('action').addEventListener('click', () => {
          clicked = true
        }, { signal })
      },
      hydrationMap: {
        version: 2,
        texts: [],
        attributes: [],
        refs: [{
          id: 'r0',
          name: 'action',
          path: [0]
        }],
        slots: []
      }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))

    const button = el.querySelector('button')
    assert.equal(button.getAttribute('ref'), `${instanceId}__action`)

    button.click()
    assert.equal(clicked, true)
  })
})
