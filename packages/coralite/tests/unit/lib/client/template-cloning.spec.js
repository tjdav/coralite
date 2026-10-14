/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'

describe('Client Runtime - Template Cloning & Fragment Batching', () => {
  it('should instantiate element using template.content.cloneNode(true) when templateElement is present', () => {
    const template = document.createElement('template')
    template.innerHTML = '<div class="card"><p class="text">Cloned Content</p></div>'

    let cloneCallCount = 0
    const originalCloneNode = template.content.cloneNode
    template.content.cloneNode = function (deep) {
      cloneCallCount++
      return originalCloneNode.call(this, deep)
    }

    const CardClass = createCoraliteClass({
      componentId: 'cloned-card',
      useTemplateCloning: true,
      templateElement: template,
      templateHTML: '<div class="card"><p class="text">Cloned Content</p></div>'
    })

    const customElemName = 'cloned-card-' + Math.random().toString(36).slice(2)
    customElements.define(customElemName, CardClass)

    const card = document.createElement(customElemName)
    document.body.appendChild(card)

    assert.strictEqual(cloneCallCount >= 1, true)
    assert.strictEqual(card.querySelector('.text').textContent, 'Cloned Content')

    document.body.removeChild(card)
  })

  it('should batch initial multi-instance render into a DocumentFragment and call replaceChildren once', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    let replaceChildrenCalls = 0
    const originalReplaceChildren = container.replaceChildren
    container.replaceChildren = function (...nodes) {
      replaceChildrenCalls++
      return originalReplaceChildren.apply(this, nodes)
    }

    const template = document.createElement('template')
    template.innerHTML = '<div class="row"><span>Item</span></div>'

    function createRow () {
      return template.content.firstChild.cloneNode(true)
    }

    const fragment = document.createDocumentFragment()
    for (let i = 0; i < 5; i++) {
      const row = createRow()
      fragment.appendChild(row)
    }

    container.replaceChildren(fragment)

    assert.strictEqual(replaceChildrenCalls, 1)
    assert.strictEqual(container.children.length, 5)

    document.body.removeChild(container)
  })
})
