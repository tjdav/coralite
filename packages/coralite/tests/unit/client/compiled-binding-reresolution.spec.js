
import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createCoraliteClass } from '../../../lib/client/element.js'
import { generateCompiledUpdaters } from '../../../lib/server/script-manager.js'

const nextTag = () => `compiled-resolve-${Math.random().toString(36).slice(2, 9)}`

function textBindingMap () {
  return {
    version: 2,
    texts: [{
      id: 'b0',
      type: 'text',
      path: [0],
      template: '{{ label }}',
      tokens: ['label'],
      isSingleToken: true,
      singleTokenKey: 'label'
    }],
    attributes: [],
    refs: [],
    slots: [],
    tokenBindings: { label: [0] },
    requiredTokens: ['label']
  }
}

function attributeBindingMap () {
  return {
    version: 2,
    texts: [],
    attributes: [{
      id: 'b0',
      type: 'attribute',
      path: [0],
      name: 'data-status',
      template: '{{ status }}',
      tokens: ['status'],
      isSingleToken: true,
      singleTokenKey: 'status',
      attrKind: 0
    }],
    refs: [],
    slots: [],
    tokenBindings: { status: [0] },
    requiredTokens: ['status']
  }
}

function defineComponent ({ tag, map, defaultValues, compiled = true }) {
  const source = compiled ? generateCompiledUpdaters(map, new Set(), 'all') : null
  const ElementClass = createCoraliteClass({
    componentId: tag,
    defaultValues,
    hydrationMap: map,
    _updaters: source ? new Function(`return (${source})`)() : null
  })
  customElements.define(tag, ElementClass)
  return ElementClass
}

function createMarkedNode (tagName, id, ownerId, text = '') {
  const node = document.createElement(tagName)
  node.setAttribute('data-coralite-bind', id)
  node.setAttribute('data-coralite-bind-owner', ownerId)
  node.textContent = text
  return node
}

describe('Compiled binding re-resolution', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    window.__coralite__ = { mode: 'testing' }
  })

  it('re-resolves a replaced text binding node by marker', async () => {
    const tag = nextTag()
    const iid = `${tag}-0`
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial><c-token data-coralite-bind="b0" data-coralite-bind-owner="${iid}">one</c-token></${tag}>`
    defineComponent({
      tag,
      map: textBindingMap(),
      defaultValues: { label: 'one' }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))

    const oldNode = el.querySelector('[data-coralite-bind="b0"]')
    const replacement = createMarkedNode('c-token', 'b0', iid, 'one')
    oldNode.replaceWith(replacement)

    el._state.label = 'two'
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(replacement.textContent, 'two')
    assert.equal(el._bindings[0].node, replacement)
  })

  it('re-resolves a replaced attribute binding node by marker', async () => {
    const tag = nextTag()
    const iid = `${tag}-0`
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial><div data-coralite-bind="b0" data-coralite-bind-owner="${iid}" data-status="idle"></div></${tag}>`
    defineComponent({
      tag,
      map: attributeBindingMap(),
      defaultValues: { status: 'idle' }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))

    const oldNode = el.querySelector('[data-coralite-bind="b0"]')
    const replacement = createMarkedNode('div', 'b0', iid)
    replacement.setAttribute('data-status', 'idle')
    oldNode.replaceWith(replacement)

    el._state.status = 'active'
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(replacement.getAttribute('data-status'), 'active')
    assert.equal(el._bindings[0].node, replacement)
  })

  it('resolves a marker that appears after hydration in production mode', async () => {
    window.__coralite__ = { mode: 'production' }
    const tag = nextTag()
    const iid = `${tag}-0`
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial></${tag}>`
    defineComponent({
      tag,
      map: textBindingMap(),
      defaultValues: { label: 'one' }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(el._bindings[0].node, null)

    const late = createMarkedNode('c-token', 'b0', iid, 'stale')
    el.appendChild(late)

    el._state.label = 'two'
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(late.textContent, 'two')
    assert.equal(el._bindings[0].node, late)
  })

  it('retries unresolved bindings after an unrelated state change', async () => {
    window.__coralite__ = { mode: 'production' }
    const tag = nextTag()
    const iid = `${tag}-0`
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial></${tag}>`
    defineComponent({
      tag,
      map: textBindingMap(),
      defaultValues: {
        label: 'one',
        count: 0
      }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(el._bindings[0].node, null)

    const late = createMarkedNode('c-token', 'b0', iid, 'stale')
    el.appendChild(late)

    el._state.count = 1
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(late.textContent, 'one')
    assert.equal(el._bindings[0].node, late)
  })

  it('resolves a marker appended after a failed pass', async () => {
    window.__coralite__ = { mode: 'production' }
    const tag = nextTag()
    const iid = `${tag}-0`
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial></${tag}>`
    defineComponent({
      tag,
      map: textBindingMap(),
      defaultValues: { label: 'one' }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))
    el._pendingBindingRetries = 0
    el._updateDOM()
    assert.ok(el._unresolvedBindings.size > 0)

    const late = createMarkedNode('c-token', 'b0', iid, 'stale')
    el.appendChild(late)
    el._updateDOM()

    assert.equal(late.textContent, 'one')
    assert.equal(el._unresolvedBindings.size, 0)
  })

  it('refreshes a stale marker map that points at a detached node', async () => {
    const tag = nextTag()
    const iid = `${tag}-0`
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial><c-token data-coralite-bind="b0" data-coralite-bind-owner="${iid}">one</c-token></${tag}>`
    defineComponent({
      tag,
      map: textBindingMap(),
      defaultValues: { label: 'one' }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))

    el._getBindingMarkerMap()

    const oldNode = el.querySelector('[data-coralite-bind="b0"]')
    const replacement = createMarkedNode('c-token', 'b0', iid, 'one')
    oldNode.replaceWith(replacement)
    el._bindingMarkerRefreshPending = false

    assert.equal(el._resolveBindingNode(el._bindings[0]), replacement)
  })

  it('clears the marker cache and unresolved bindings on teardown', async () => {
    const tag = nextTag()
    const iid = `${tag}-0`
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial><c-token data-coralite-bind="b0" data-coralite-bind-owner="${iid}">one</c-token></${tag}>`
    defineComponent({
      tag,
      map: textBindingMap(),
      defaultValues: { label: 'one' }
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))
    el._getBindingMarkerMap()
    el._unresolvedBindings.add(el._bindings[0])

    el._teardownLifecycle()

    assert.equal(el._bindingMarkerMap, null)
    assert.equal(el._unresolvedBindings.size, 0)
  })

  it('retries an unresolved marker binding through the selective fallback path', async () => {
    window.__coralite__ = { mode: 'production' }
    const tag = nextTag()
    const iid = `${tag}-0`
    const attributes = []
    const tokenBindings = {
      count: [],
      label: []
    }

    for (let i = 0; i < 7; i++) {
      tokenBindings.count.push(attributes.length)
      attributes.push({
        path: [i],
        name: `data-count-${i}`,
        template: '{{ count }}',
        tokens: ['count'],
        isSingleToken: true,
        singleTokenKey: 'count',
        attrKind: 0
      })
    }
    tokenBindings.label.push(attributes.length)
    attributes.push({
      id: 'b7',
      type: 'attribute',
      path: [7],
      name: 'data-label',
      template: '{{ label }}',
      tokens: ['label'],
      isSingleToken: true,
      singleTokenKey: 'label',
      attrKind: 0
    })

    const map = {
      version: 2,
      texts: [],
      attributes,
      refs: [],
      slots: [],
      tokenBindings,
      requiredTokens: ['count', 'label']
    }

    const children = Array.from({ length: 7 }, (_, i) => `<div data-count-${i}="0"></div>`).join('')
    document.body.innerHTML = `<${tag} data-cid="${iid}" data-coralite-initial>${children}</${tag}>`
    defineComponent({
      tag,
      map,
      defaultValues: {
        count: 0,
        label: 'idle'
      },
      compiled: false
    })

    const el = document.querySelector(tag)
    await new Promise(resolve => setTimeout(resolve, 0))

    const labelNode = createMarkedNode('div', 'b7', iid)
    labelNode.setAttribute('data-label', 'stale')
    el.appendChild(labelNode)

    el._state.count = 1
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(labelNode.getAttribute('data-label'), 'idle')
    assert.equal(el._bindings[7].node, labelNode)
  })
})
