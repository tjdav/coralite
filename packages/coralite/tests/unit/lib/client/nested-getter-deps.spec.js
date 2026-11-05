/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'
import { generateCompiledUpdaters } from '../../../../lib/server/script-manager.js'

function createAttributeBinding (name, token) {
  return {
    path: [0],
    name,
    template: `{{ ${token} }}`,
    tokens: [token],
    isSingleToken: true,
    singleTokenKey: token,
    attrKind: 0
  }
}

function createCompiledUpdaters (hydrationMap, tokens) {
  const source = generateCompiledUpdaters(hydrationMap, new Set(tokens), 'all')
  assert.notStrictEqual(source, 'null', 'compiled updaters should be generated')
  return new Function(`return (${source})`)()
}

function createComponent ({ componentId, defaultValues, getters, bindings }) {
  const attributes = []
  const tokenBindings = {}
  for (const [index, binding] of bindings.entries()) {
    attributes.push(createAttributeBinding(binding.name, binding.token))
    if (!tokenBindings[binding.token]) {
      tokenBindings[binding.token] = []
    }
    tokenBindings[binding.token].push(index)
  }
  const hydrationMap = {
    texts: [],
    attributes,
    tokenBindings,
    requiredTokens: Object.keys(tokenBindings)
  }
  const updaters = createCompiledUpdaters(hydrationMap, Object.keys(tokenBindings))
  const ComponentClass = createCoraliteClass({
    componentId,
    defaultValues,
    getters,
    hydrationMap,
    _updaters: updaters
  })
  const tagName = `${componentId}-${Math.random().toString(36).slice(2, 8)}`
  customElements.define(tagName, ComponentClass)

  const element = document.createElement(tagName)
  const node = document.createElement('div')
  element.appendChild(node)
  document.body.appendChild(element)
  return {
    element,
    node
  }
}

function getterDeps (element, key) {
  const deps = element._getterDeps ? element._getterDeps.get(key) : null
  return deps ? [...deps] : []
}

describe('Client Runtime - Nested Getter Dependency Tracking', () => {
  it('updates a nested getter chain after a cached reactive read', async () => {
    const { element, node } = createComponent({
      componentId: 'nested-getter-chain',
      defaultValues: {
        loading: true,
        firstName: 'Alice'
      },
      getters: {
        showChrome: ({ state }) => !state.loading,
        label: ({ state }) => (state.showChrome ? 'visible' : 'hidden'),
        summary: ({ state }) => `${state.firstName}:${state.label}`
      },
      bindings: [
        {
          name: 'data-summary',
          token: 'summary'
        },
        {
          name: 'data-label',
          token: 'label'
        },
        {
          name: 'data-chrome',
          token: 'showChrome'
        }
      ]
    })

    await element.updateComplete
    assert.strictEqual(node.getAttribute('data-summary'), 'Alice:hidden')

    element._state.summary
    element._state.firstName = 'Bob'
    await element.updateComplete
    assert.strictEqual(node.getAttribute('data-summary'), 'Bob:hidden')

    element._state.loading = false
    await element.updateComplete
    assert.strictEqual(node.getAttribute('data-chrome'), 'true')
    assert.strictEqual(node.getAttribute('data-label'), 'visible')
    assert.strictEqual(node.getAttribute('data-summary'), 'Bob:visible')

    document.body.removeChild(element)
  })

  it('preserves getter dependencies across cached reactive reads', async () => {
    const { element } = createComponent({
      componentId: 'nested-getter-cached',
      defaultValues: {
        loading: true,
        firstName: 'Alice'
      },
      getters: {
        showChrome: ({ state }) => !state.loading,
        label: ({ state }) => (state.showChrome ? 'visible' : 'hidden'),
        summary: ({ state }) => `${state.firstName}:${state.label}`
      },
      bindings: [
        {
          name: 'data-summary',
          token: 'summary'
        },
        {
          name: 'data-label',
          token: 'label'
        },
        {
          name: 'data-chrome',
          token: 'showChrome'
        }
      ]
    })

    await element.updateComplete
    element._state.summary
    element._state.label
    element._state.showChrome

    assert.ok(getterDeps(element, 'summary').includes('loading'), 'summary keeps its transitive deps')
    assert.ok(getterDeps(element, 'label').includes('loading'), 'label keeps its transitive deps')
    assert.ok(getterDeps(element, 'showChrome').includes('loading'), 'showChrome keeps its deps')

    document.body.removeChild(element)
  })

  it('refreshes a getter dependency set when it re-evaluates', async () => {
    const { element, node } = createComponent({
      componentId: 'nested-getter-precision',
      defaultValues: {
        useA: true,
        a: 'A',
        b: 'B'
      },
      getters: {
        pick: ({ state }) => (state.useA ? state.a : state.b)
      },
      bindings: [
        {
          name: 'data-pick',
          token: 'pick'
        }
      ]
    })

    await element.updateComplete
    assert.strictEqual(node.getAttribute('data-pick'), 'A')
    assert.ok(getterDeps(element, 'pick').includes('a'), 'active branch dependency is tracked')

    element._state.useA = false
    await element.updateComplete
    assert.strictEqual(node.getAttribute('data-pick'), 'B')
    assert.ok(getterDeps(element, 'pick').includes('b'), 'new branch dependency is tracked')
    assert.ok(!getterDeps(element, 'pick').includes('a'), 'inactive branch dependency is dropped')

    document.body.removeChild(element)
  })
})
