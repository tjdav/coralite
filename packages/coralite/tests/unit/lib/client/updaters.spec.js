/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'

describe('Client Runtime - Compiled Per-Token Updaters', () => {
  it('updates text binding when state key changes via _updaters', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'updater-test-1',
      defaultValues: { count: 10 },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ count }}',
            tokens: ['count'],
            isSingleToken: true,
            singleTokenKey: 'count'
          }
        ],
        requiredTokens: ['count']
      },
      _updaters: {
        count () {
          const value = this._stateRaw.count
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

    const tagName = 'updater-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('10')
    const span = document.createElement('span')
    span.appendChild(textNode)
    el.appendChild(span)
    document.body.appendChild(el)

    await el.updateComplete

    assert.ok(el._updaters, '_updaters should be defined')

    el._state.count = 42
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, '42')

    document.body.removeChild(el)
  })

  it('updates attribute binding with correct attrKind semantics', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'updater-test-2',
      defaultValues: {
        title: 'Hello',
        disabled: false,
        label: 'Click'
      },
      hydrationMap: {
        attributes: [
          {
            path: [0],
            name: 'title',
            template: '{{ title }}',
            tokens: ['title'],
            isSingleToken: true,
            singleTokenKey: 'title',
            attrKind: 0
          },
          {
            path: [0],
            name: 'disabled',
            template: '{{ disabled }}',
            tokens: ['disabled'],
            isSingleToken: true,
            singleTokenKey: 'disabled',
            attrKind: 1
          }
        ],
        requiredTokens: ['title', 'disabled']
      },
      _updaters: {
        title () {
          const value = this._stateRaw.title
          const binding = this._bindings[0]
          const element = binding.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          if (value == null) {
            element.removeAttribute(binding.name)
          } else if (element.getAttribute(binding.name) !== String(value)) {
            element.setAttribute(binding.name, String(value))
          }
        },
        disabled () {
          const value = this._stateRaw.disabled
          const binding = this._bindings[1]
          const element = binding.node
          const isFalsy = value === '' || value === false || value === 'false' || value === null || value === undefined
          if (isFalsy) {
            element.removeAttribute(binding.name)
          } else {
            element.setAttribute(binding.name, '')
          }
        }
      }
    })

    const tagName = 'updater-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const btn = document.createElement('button')
    btn.setAttribute('title', 'Hello')
    el.appendChild(btn)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.title = 'Updated Title'
    el._state.disabled = true
    await el.updateComplete

    assert.strictEqual(btn.getAttribute('title'), 'Updated Title')
    assert.strictEqual(btn.hasAttribute('disabled'), true)

    document.body.removeChild(el)
  })

  it('joins segments and updates multi-token bindings', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'updater-test-3',
      defaultValues: {
        firstName: 'Alice',
        lastName: 'Smith'
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: 'Hello {{ firstName }} {{ lastName }}!',
            tokens: ['firstName', 'lastName'],
            isSingleToken: false,
            segments: [[0, 'Hello '], [1, 'firstName'], [0, ' '], [1, 'lastName'], [0, '!']]
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

    const tagName = 'updater-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('Hello Alice Smith!')
    const p = document.createElement('p')
    p.appendChild(textNode)
    el.appendChild(p)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.firstName = 'Bob'
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, 'Hello Bob Smith!')

    document.body.removeChild(el)
  })

  it('re-evaluates getter and updates getter-bound tokens', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'updater-test-4',
      defaultValues: { count: 5 },
      getters: {
        doubled ({ state }) {
          return state.count * 2
        }
      },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ doubled }}',
            tokens: ['doubled'],
            isSingleToken: true,
            singleTokenKey: 'doubled'
          }
        ],
        requiredTokens: ['doubled']
      },
      _updaters: {
        doubled () {
          const value = this._state.doubled
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

    const tagName = 'updater-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('10')
    const span = document.createElement('span')
    span.appendChild(textNode)
    el.appendChild(span)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.count = 21
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, '42')

    document.body.removeChild(el)
  })

  it('handles nullish token values correctly (empty string text / attribute removal)', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'updater-test-5',
      defaultValues: { value: 'initial' },
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
        attributes: [
          {
            path: [1],
            name: 'title',
            template: '{{ value }}',
            tokens: ['value'],
            isSingleToken: true,
            singleTokenKey: 'value',
            attrKind: 0
          }
        ],
        requiredTokens: ['value']
      },
      _updaters: {
        value () {
          const value = this._stateRaw.value
          const b0 = this._bindings[0]
          const textNode = b0.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          const nextText = value == null ? '' : String(value)
          if (textNode.nodeValue !== nextText) {
            textNode.nodeValue = nextText
          }

          const b1 = this._bindings[1]
          const element = b1.node
          // eslint-disable-next-line eqeqeq -- intentionally matches null and undefined
          if (value == null) {
            if (element.hasAttribute(b1.name)) {
              element.removeAttribute(b1.name)
            }
          } else {
            const strVal = String(value)
            if (element.getAttribute(b1.name) !== strVal) {
              element.setAttribute(b1.name, strVal)
            }
          }
        }
      }
    })

    const tagName = 'updater-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('initial')
    const span = document.createElement('span')
    span.appendChild(textNode)
    const div = document.createElement('div')
    div.setAttribute('title', 'initial')

    el.appendChild(span)
    el.appendChild(div)
    document.body.appendChild(el)

    await el.updateComplete

    el._state.value = null
    await el.updateComplete

    assert.strictEqual(textNode.nodeValue, '')
    assert.strictEqual(div.hasAttribute('title'), false)

    document.body.removeChild(el)
  })

  it('falls back to map-walk when compilerOptimizations is "none"', async () => {
    const ComponentClass = createCoraliteClass({
      componentId: 'updater-test-6',
      compilerOptimizations: 'none',
      defaultValues: { count: 1 },
      hydrationMap: {
        texts: [
          {
            path: [0, 0],
            template: '{{ count }}',
            tokens: ['count'],
            isSingleToken: true,
            singleTokenKey: 'count'
          }
        ],
        requiredTokens: ['count']
      }
    })

    const tagName = 'updater-test-' + Math.random().toString(36).slice(2)
    customElements.define(tagName, ComponentClass)

    const el = document.createElement(tagName)
    const textNode = document.createTextNode('1')
    const span = document.createElement('span')
    span.appendChild(textNode)
    el.appendChild(span)
    document.body.appendChild(el)

    await el.updateComplete

    assert.strictEqual(el._updaters, null)

    el._state.count = 99
    await el.updateComplete

    assert.strictEqual(textNode.textContent, '99')

    document.body.removeChild(el)
  })
})
