/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import '../../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../../lib/client/element.js'
import { generateCompiledUpdaters } from '../../../../lib/server/script-manager.js'

const FANOUT_SIZE = 4

function createFanoutBinding (path, token) {
  return {
    path: [path],
    name: 'hidden',
    template: `{{ ${token} }}`,
    tokens: [token],
    isSingleToken: true,
    singleTokenKey: token,
    attrKind: 1
  }
}

function createFanoutMap (token) {
  const indices = []
  const attributes = []
  for (let i = 0; i < FANOUT_SIZE; i++) {
    indices.push(i)
    attributes.push(createFanoutBinding(i, token))
  }
  return {
    texts: [],
    attributes,
    tokenBindings: { [token]: indices },
    requiredTokens: [token]
  }
}

function createCompiledUpdaters (hydrationMap, getterToken = null) {
  const getterKeys = getterToken ? new Set([getterToken]) : new Set()
  const source = generateCompiledUpdaters(hydrationMap, getterKeys, 'all')
  assert.notStrictEqual(source, 'null', 'compiled updaters should be generated')
  return new Function(`return (${source})`)()
}

function createFanoutComponent ({ token, getters = null, compiled = true }) {
  const hydrationMap = createFanoutMap(token)
  const getterToken = getters && Object.prototype.hasOwnProperty.call(getters, token) ? token : null
  const updaters = compiled ? createCompiledUpdaters(hydrationMap, getterToken) : null
  const ComponentClass = createCoraliteClass({
    componentId: `getter-fanout-${token}`,
    defaultValues: { loading: true },
    getters: getters || {},
    hydrationMap,
    _updaters: updaters
  })
  const tagName = `getter-fanout-${token.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`
  customElements.define(tagName, ComponentClass)

  const element = document.createElement(tagName)
  const nodes = []
  for (let i = 0; i < FANOUT_SIZE; i++) {
    const node = document.createElement('div')
    element.appendChild(node)
    nodes.push(node)
  }
  document.body.appendChild(element)
  return {
    element,
    nodes
  }
}

function hiddenStates (nodes) {
  return nodes.map(node => node.hasAttribute('hidden'))
}

function allHidden (value) {
  return Array.from({ length: FANOUT_SIZE }, () => value)
}

describe('Client Runtime - Derived Getter Fan-out Updates', () => {
  it('updates every fan-out node when a getter dependency changes', async () => {
    const { element, nodes } = createFanoutComponent({
      token: 'showChrome',
      getters: { showChrome: ({ state }) => !state.loading }
    })

    await element.updateComplete
    assert.deepStrictEqual(hiddenStates(nodes), allHidden(false), 'initial render is visible')

    element._state.loading = false
    await element.updateComplete
    assert.deepStrictEqual(hiddenStates(nodes), allHidden(true), 'all nodes update to hidden')

    element._state.loading = true
    await element.updateComplete
    assert.deepStrictEqual(hiddenStates(nodes), allHidden(false), 'all nodes update back to visible')

    document.body.removeChild(element)
  })

  it('retains getter dependencies after hydration and after an update', async () => {
    const { element } = createFanoutComponent({
      token: 'showChrome',
      getters: { showChrome: ({ state }) => !state.loading }
    })

    await element.updateComplete
    assert.ok(element._getterDeps, '_getterDeps should be initialized')
    assert.ok(element._getterDeps.get('showChrome').has('loading'), 'dependency is tracked after hydration')

    element._state.loading = false
    await element.updateComplete
    assert.ok(element._getterDeps.get('showChrome').has('loading'), 'dependency survives an update')

    document.body.removeChild(element)
  })

  it('updates every fan-out node through the fallback path without compiled updaters', async () => {
    const { element, nodes } = createFanoutComponent({
      token: 'showChrome',
      getters: { showChrome: ({ state }) => !state.loading },
      compiled: false
    })

    await element.updateComplete
    element._state.loading = false
    await element.updateComplete

    assert.deepStrictEqual(hiddenStates(nodes), allHidden(true), 'fallback path updates all nodes')

    document.body.removeChild(element)
  })

  it('updates every fan-out node bound to a raw state token', async () => {
    const { element, nodes } = createFanoutComponent({ token: 'loading' })

    await element.updateComplete
    element._state.loading = false
    await element.updateComplete

    assert.deepStrictEqual(hiddenStates(nodes), allHidden(false), 'raw token updates all nodes')

    document.body.removeChild(element)
  })

  it('re-runs a bound getter when its recorded dependency set is empty', async () => {
    const { element, nodes } = createFanoutComponent({
      token: 'showChrome',
      getters: { showChrome: ({ state }) => !state.loading }
    })

    await element.updateComplete
    element._getterDeps.set('showChrome', new Set())
    element._state.loading = false
    await element.updateComplete

    assert.deepStrictEqual(hiddenStates(nodes), allHidden(true), 'untracked getter still updates all nodes')

    document.body.removeChild(element)
  })

  it('updates getter bindings in the selective fallback path with more than six bindings', async () => {
    const attributes = []
    const tokenBindings = {
      loading: [],
      showChrome: []
    }
    for (let i = 0; i < FANOUT_SIZE; i++) {
      tokenBindings.loading.push(attributes.length)
      attributes.push(createFanoutBinding(i * 2, 'loading'))
      tokenBindings.showChrome.push(attributes.length)
      attributes.push(createFanoutBinding((i * 2) + 1, 'showChrome'))
    }
    const hydrationMap = {
      texts: [],
      attributes,
      tokenBindings,
      requiredTokens: ['loading', 'showChrome']
    }
    const ComponentClass = createCoraliteClass({
      componentId: 'getter-fanout-selective',
      defaultValues: { loading: true },
      getters: { showChrome: ({ state }) => !state.loading },
      hydrationMap,
      _updaters: null
    })
    const tagName = `getter-fanout-selective-${Math.random().toString(36).slice(2, 8)}`
    customElements.define(tagName, ComponentClass)

    const element = document.createElement(tagName)
    const rawNodes = []
    const getterNodes = []
    for (let i = 0; i < FANOUT_SIZE; i++) {
      const rawNode = document.createElement('div')
      const getterNode = document.createElement('div')
      element.appendChild(rawNode)
      element.appendChild(getterNode)
      rawNodes.push(rawNode)
      getterNodes.push(getterNode)
    }
    document.body.appendChild(element)

    await element.updateComplete
    element._getterDeps.set('showChrome', new Set())
    element._state.loading = false
    await element.updateComplete

    assert.deepStrictEqual(hiddenStates(rawNodes), allHidden(false), 'raw bindings update')
    assert.deepStrictEqual(hiddenStates(getterNodes), allHidden(true), 'getter bindings update')

    document.body.removeChild(element)
  })
})
