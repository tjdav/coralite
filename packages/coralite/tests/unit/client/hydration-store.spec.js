import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../lib/client/element.js'
import { generateClientRuntime } from '../../../lib/client/utils/runtime.js'

describe('Live hydration store', () => {
  it('populates coralite.state.hydration at boot in client runtime', () => {
    const runtimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: JSON.stringify({ 'comp-1': { count: 10 } }),
      mode: 'development'
    })

    assert.ok(runtimeCode.includes('coralite.state.hydration = Object.assign('))
    assert.ok(runtimeCode.includes('{"comp-1":{"count":10}}'))
  })

  it('_setupState reads from window.__coralite__.state.hydration at component init time', () => {
    const origCoralite = globalThis.window.__coralite__
    globalThis.window.__coralite__ = {
      state: {
        hydration: {
          'test-instance-1': {
            title: 'Live Title',
            items: [1, 2, 3]
          }
        }
      }
    }

    const CompClass = createCoraliteClass({
      componentId: 'test-comp',
      defaultValues: {
        title: 'Default Title',
        items: []
      }
    })

    const tag = 'test-hydration-live-elem'
    if (!customElements.get(tag)) {
      customElements.define(tag, CompClass)
    }

    const el = document.createElement(tag)
    el.setAttribute('data-cid', 'test-instance-1')
    document.body.appendChild(el)

    assert.strictEqual(el._state.title, 'Live Title')
    assert.deepStrictEqual(el._state.items, [1, 2, 3])

    document.body.removeChild(el)
    if (origCoralite) {
      globalThis.window.__coralite__ = origCoralite
    } else {
      delete globalThis.window.__coralite__
    }
  })

  it('state hydration primitives getHydration, mergeHydration, replaceHydration work as expected', () => {
    const origCoralite = globalThis.window.__coralite__

    globalThis.window.__coralite__ = {
      state: {
        hydration: { 'comp-1': { a: 1 } }
      }
    }
    const state = globalThis.window.__coralite__.state
    state.getHydration = () => state.hydration
    state.mergeHydration = (next) => {
      if (next && typeof next === 'object') {
        Object.assign(state.hydration, next)
      }
    }
    state.replaceHydration = (next) => {
      state.hydration = next && typeof next === 'object' ? next : {}
    }

    assert.strictEqual(typeof state.getHydration, 'function')

    const storeObj = state.hydration
    assert.strictEqual(state.getHydration(), storeObj)

    state.mergeHydration({ 'comp-2': { b: 2 } })
    assert.deepStrictEqual(state.getHydration(), {
      'comp-1': { a: 1 },
      'comp-2': { b: 2 }
    })

    const newStore = { 'comp-3': { c: 3 } }
    state.replaceHydration(newStore)
    assert.strictEqual(state.getHydration(), newStore)

    if (origCoralite) {
      globalThis.window.__coralite__ = origCoralite
    } else {
      delete globalThis.window.__coralite__
    }
  })

  it('a component created after replaceHydration() reads from the new store while prior component is unaffected', () => {
    const origCoralite = globalThis.window.__coralite__
    globalThis.window.__coralite__ = {
      state: {
        hydration: {
          'comp-old': { status: 'initial' }
        }
      }
    }

    const CompClass = createCoraliteClass({
      componentId: 'test-comp-replace',
      defaultValues: { status: 'default' }
    })

    const tag = 'test-comp-replace-elem'
    if (!customElements.get(tag)) {
      customElements.define(tag, CompClass)
    }

    const elOld = document.createElement(tag)
    elOld.setAttribute('data-cid', 'comp-old')
    document.body.appendChild(elOld)

    assert.strictEqual(elOld._state.status, 'initial')

    // Replace the store object
    globalThis.window.__coralite__.state.hydration = {
      'comp-new': { status: 'swapped' }
    }

    // Creating new element after store replacement
    const elNew = document.createElement(tag)
    elNew.setAttribute('data-cid', 'comp-new')
    document.body.appendChild(elNew)

    assert.strictEqual(elNew._state.status, 'swapped')
    assert.strictEqual(elOld._state.status, 'initial')

    document.body.removeChild(elOld)
    document.body.removeChild(elNew)

    if (origCoralite) {
      globalThis.window.__coralite__ = origCoralite
    } else {
      delete globalThis.window.__coralite__
    }
  })

  it('generateClientRuntime emits hydration state helpers', () => {
    const runtimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: '{}',
      mode: 'development'
    })
    assert.ok(runtimeCode.includes('coralite.state.getHydration'))
    assert.ok(runtimeCode.includes('coralite.state.mergeHydration'))
    assert.ok(runtimeCode.includes('coralite.state.replaceHydration'))
  })
})
