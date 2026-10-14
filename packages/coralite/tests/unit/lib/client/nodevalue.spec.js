/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'

describe('Client Runtime - nodeValue Text Bindings', () => {
  it('single-token text binding writes to text node nodeValue', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'nodevalue-single-test',
      defaultValues: { name: 'World' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ name }}',
            tokens: ['name'],
            isSingleToken: true,
            singleTokenKey: 'name'
          }
        ],
        requiredTokens: ['name']
      },
      _updaters: {
        name () {
          const value = this._stateRaw.name
          const binding = this._bindings[0]
          const node = binding.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          const next = value == null ? '' : String(value)
          if (node.nodeValue !== next) {
            node.nodeValue = next
          }
        }
      }
    })

    const tagName = 'nodevalue-single-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('World')
    const p = document.createElement('p')
    p.appendChild(textNode)
    el.appendChild(p)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._bindings[0].type, 'text')

    el._state.name = 'Coralite'
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, 'Coralite')

    document.body.removeChild(el)
  })

  it('multi-segment text binding writes to text node nodeValue', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'nodevalue-multi-test',
      defaultValues: {
        firstName: 'Jane',
        lastName: 'Doe'
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: 'Welcome, {{ firstName }} {{ lastName }}!',
            tokens: ['firstName', 'lastName'],
            isSingleToken: false,
            segments: [[0, 'Welcome, '], [1, 'firstName'], [0, ' '], [1, 'lastName'], [0, '!']]
          }
        ],
        requiredTokens: ['firstName', 'lastName']
      },
      _updaters: {
        firstName () {
          const binding = this._bindings[0]
          const node = binding.node
          const segments = binding.segments
          let out = ''
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i]
            out += seg[0] === 0 ? seg[1] : String(this._stateRaw[seg[1]] ?? '')
          }
          if (node.nodeValue !== out) {
            node.nodeValue = out
          }
        }
      }
    })

    const tagName = 'nodevalue-multi-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('Welcome, Jane Doe!')
    const p = document.createElement('p')
    p.appendChild(textNode)
    el.appendChild(p)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.firstName = 'John'
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, 'Welcome, John Doe!')

    document.body.removeChild(el)
  })

  it('nullish text value writes empty string via nodeValue', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'nodevalue-nullish-test',
      defaultValues: { label: 'Active' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ label }}',
            tokens: ['label'],
            isSingleToken: true,
            singleTokenKey: 'label'
          }
        ],
        requiredTokens: ['label']
      },
      _updaters: {
        label () {
          const value = this._stateRaw.label
          const binding = this._bindings[0]
          const node = binding.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          const next = value == null ? '' : String(value)
          if (node.nodeValue !== next) {
            node.nodeValue = next
          }
        }
      }
    })

    const tagName = 'nodevalue-nullish-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('Active')
    const span = document.createElement('span')
    span.appendChild(textNode)
    el.appendChild(span)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.label = null
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, '')

    el._state.label = undefined
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, '')

    document.body.removeChild(el)
  })

  it('element binding continues to use innerHTML or textContent (regression)', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'nodevalue-html-test',
      defaultValues: { rawHtml: '<strong>Hello</strong>' },
      hydrationMap: {
        texts: [
          {
            path: [0],
            template: '{{ rawHtml }}',
            tokens: ['rawHtml'],
            isSingleToken: true,
            singleTokenKey: 'rawHtml',
            type: 'html'
          }
        ],
        requiredTokens: ['rawHtml']
      },
      _updaters: {
        rawHtml () {
          const value = this._stateRaw.rawHtml
          const binding = this._bindings[0]
          const node = binding.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          const next = value == null ? '' : String(value)
          if (node.innerHTML !== next) {
            node.innerHTML = next
          }
        }
      }
    })

    const tagName = 'nodevalue-html-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const div = document.createElement('div')
    el.appendChild(div)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._bindings[0].type, 'html')

    el._state.rawHtml = '<em>Updated HTML</em>'
    await el.updateComplete

    assert.strictEqual(div.innerHTML, '<em>Updated HTML</em>')

    document.body.removeChild(el)
  })

  it('attribute binding continues to use setAttribute (regression)', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'nodevalue-attr-test',
      defaultValues: { status: 'active' },
      hydrationMap: {
        attributes: [
          {
            path: [0],
            name: 'data-status',
            template: '{{ status }}',
            tokens: ['status'],
            isSingleToken: true,
            singleTokenKey: 'status',
            attrKind: 0
          }
        ],
        requiredTokens: ['status']
      },
      _updaters: {
        status () {
          const value = this._stateRaw.status
          const binding = this._bindings[0]
          const element = binding.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          if (value == null) {
            if (element.hasAttribute(binding.name)) {
              element.removeAttribute(binding.name)
            }
          } else {
            const strVal = String(value)
            if (element.getAttribute(binding.name) !== strVal) {
              element.setAttribute(binding.name, strVal)
            }
          }
        }
      }
    })

    const tagName = 'nodevalue-attr-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const div = document.createElement('div')
    div.setAttribute('data-status', 'active')
    el.appendChild(div)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._bindings[0].type, 'attribute')

    el._state.status = 'inactive'
    await el.updateComplete

    assert.strictEqual(div.getAttribute('data-status'), 'inactive')

    document.body.removeChild(el)
  })

  it('compilerOptimizations: "none" falls back to textContent for text bindings', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'nodevalue-none-test',
      compilerOptimizations: 'none',
      defaultValues: { text: 'Initial' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ text }}',
            tokens: ['text'],
            isSingleToken: true,
            singleTokenKey: 'text'
          }
        ],
        requiredTokens: ['text']
      }
    })

    const tagName = 'nodevalue-none-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('Initial')
    const p = document.createElement('p')
    p.appendChild(textNode)
    el.appendChild(p)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.text = 'Fallback Value'
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, 'Fallback Value')
    assert.strictEqual(textNode.textContent, 'Fallback Value')

    document.body.removeChild(el)
  })

  it('write is idempotent — setting same value does not mutate nodeValue', async () => {
    let nodeValueWrites = 0
    const ComponentClass = createCoraliteClass({
      componentId: 'nodevalue-idempotent-test',
      defaultValues: { value: 'same' },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ value }}',
            tokens: ['value'],
            isSingleToken: true,
            singleTokenKey: 'value'
          }
        ],
        requiredTokens: ['value']
      },
      _updaters: {
        value () {
          const value = this._stateRaw.value
          const binding = this._bindings[0]
          const node = binding.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          const next = value == null ? '' : String(value)
          if (node.nodeValue !== next) {
            nodeValueWrites++
            node.nodeValue = next
          }
        }
      }
    })

    const tagName = 'nodevalue-idempotent-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('same')
    const p = document.createElement('p')
    p.appendChild(textNode)
    el.appendChild(p)
    document.body.appendChild(el)

    await el.updateComplete

    nodeValueWrites = 0
    el._updaters.value.call(el)

    assert.strictEqual(nodeValueWrites, 0)

    document.body.removeChild(el)
  })
})
