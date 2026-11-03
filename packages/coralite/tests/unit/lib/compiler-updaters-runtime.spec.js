import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCoraliteClass } from '../../../lib/client/element.js'

describe('Compiler Updaters Runtime - Text & Attribute Coexistence', () => {
  it('updates attribute in DOM when component has both text and attribute updaters', async () => {
    const tagName = 'test-banner-' + Math.random().toString(36).substring(2, 9)
    const ComponentClass = createCoraliteClass({
      componentId: tagName,
      compilerOptimizations: 'all',
      defaultValues: {
        isHidden: false,
        message: 'Hello'
      },
      templateHTML: '<div class="banner"><span>Hello</span></div>',
      hydrationMap: {
        tokenBindings: {
          message: [0],
          isHidden: [1]
        },
        texts: [{
          type: 'text',
          path: [0, 0, 0],
          isSingleToken: true
        }],
        attributes: [{
          type: 'attribute',
          path: [0],
          name: 'hidden',
          attrKind: 1,
          isSingleToken: true
        }]
      },
      _updaters: {
        message: function () {
          const value = this._state.message
          const node = this.getNodeByPath([0, 0, 0])
          if (node) {
            node.nodeValue = value
          }
        },
        isHidden: function () {
          const value = this._state.isHidden
          const element = this.getNodeByPath([0])
          if (!element) {
            return
          }
          if (!value) {
            element.removeAttribute('hidden')
          } else {
            element.setAttribute('hidden', '')
          }
        }
      }
    })

    customElements.define(tagName, ComponentClass)
    const el = document.createElement(tagName)
    document.body.appendChild(el)
    await el.updateComplete

    const banner = el.querySelector('.banner')
    const span = el.querySelector('span')
    assert.strictEqual(span.textContent, 'Hello')
    assert.strictEqual(banner.hasAttribute('hidden'), false)

    el._state.message = 'Updated'
    el._state.isHidden = true
    await el.updateComplete

    assert.strictEqual(span.textContent, 'Updated')
    assert.strictEqual(banner.hasAttribute('hidden'), true)
  })
})
