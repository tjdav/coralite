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

function createBareComponent ({ componentId, defaultValues, getters }) {
  const ComponentClass = createCoraliteClass({
    componentId,
    defaultValues,
    getters
  })
  const tagName = `${componentId}-${Math.random().toString(36).slice(2, 8)}`
  customElements.define(tagName, ComponentClass)

  const element = document.createElement(tagName)
  document.body.appendChild(element)
  return element
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

  it('unions previous and partial dependencies when a getter throws', () => {
    const element = createBareComponent({
      componentId: 'getter-dep-error',
      defaultValues: {
        source: 'a',
        extra: 'x',
        fail: false
      },
      getters: {
        value: ({ state }) => {
          if (state.fail) {
            state.extra
            throw new Error('boom')
          }
          return state.source
        }
      }
    })

    assert.strictEqual(element._state.value, 'a')
    assert.deepStrictEqual(new Set(getterDeps(element, 'value')), new Set(['source', 'fail']))

    element._state.fail = true
    assert.throws(() => element._state.value, /boom/)

    const afterThrow = getterDeps(element, 'value')
    assert.ok(afterThrow.includes('source'), 'last successful dependency is retained')
    assert.ok(afterThrow.includes('fail'), 'the failing flag remains tracked')
    assert.ok(afterThrow.includes('extra'), 'the newly-read dependency is retained')

    element._state.fail = false
    assert.strictEqual(element._state.value, 'a')
    assert.ok(!getterDeps(element, 'value').includes('extra'), 'successful evaluation drops the failed branch dependency')

    document.body.removeChild(element)
  })

  it('writes dependencies to the current getter dependency entry', () => {
    const element = createBareComponent({
      componentId: 'getter-dep-current-entry',
      defaultValues: {
        loading: true
      },
      getters: {
        showChrome: ({ state }) => !state.loading
      }
    })

    assert.strictEqual(element._stateRaw.showChrome, false)
    assert.deepStrictEqual(new Set(getterDeps(element, 'showChrome')), new Set(['loading']))

    const replacement = new Set()
    element._getterDeps.set('showChrome', replacement)
    element._state.loading = false

    assert.strictEqual(element._stateRaw.showChrome, true)
    assert.ok(replacement.has('loading'), 'tracking targets the replaced dependency set')

    document.body.removeChild(element)
  })

  it('retains the dependency union through a getter re-init on reconnect', () => {
    const element = createBareComponent({
      componentId: 'getter-dep-reinit',
      defaultValues: {
        source: 'a',
        extra: 'x',
        fail: false
      },
      getters: {
        value: ({ state }) => {
          if (state.fail) {
            state.extra
            throw new Error('boom')
          }
          return state.source
        }
      }
    })

    assert.strictEqual(element._state.value, 'a')

    element.remove()
    document.body.appendChild(element)

    assert.strictEqual(element._state.value, 'a')

    element._state.fail = true
    assert.throws(() => element._state.value, /boom/)

    const deps = getterDeps(element, 'value')
    assert.ok(deps.includes('source'), 'last successful dependency survives re-init')
    assert.ok(deps.includes('extra'), 'failed branch dependency survives re-init')

    document.body.removeChild(element)
  })
})
