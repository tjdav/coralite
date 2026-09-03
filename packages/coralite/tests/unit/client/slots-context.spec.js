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
})
