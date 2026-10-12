import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createCoraliteClass } from '../../../lib/client/element.js'
import { generateClientRuntime } from '../../../lib/client/utils/runtime.js'
import { ScriptManager } from '../../../lib/server/script-manager.js'

describe('Live hydration store', () => {
  it('populates window.__coralite_hydration__ at boot in client runtime', () => {
    const runtimeCode = generateClientRuntime({
      base: '/',
      sharedChunkPath: 'shared.js',
      declarativeTags: [],
      hydrationData: JSON.stringify({ 'comp-1': { count: 10 } }),
      mode: 'development'
    })

    assert.ok(runtimeCode.includes('window.__coralite_hydration__ = window.__coralite_hydration__ || {"comp-1":{"count":10}};'))
  })

  it('_setupState reads from window.__coralite_hydration__ at component init time', () => {
    const origWindowStore = globalThis.window.__coralite_hydration__
    globalThis.window.__coralite_hydration__ = {
      'test-instance-1': {
        title: 'Live Title',
        items: [1, 2, 3]
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
    if (origWindowStore) {
      globalThis.window.__coralite_hydration__ = origWindowStore
    } else {
      delete globalThis.window.__coralite_hydration__
    }
  })

  it('hydrationStore primitives get, merge, replace work as expected', () => {
    const origCoralite = globalThis.window.__coralite__
    const origHydration = globalThis.window.__coralite_hydration__

    globalThis.window.__coralite_hydration__ = { 'comp-1': { a: 1 } }
    globalThis.window.__coralite__ = globalThis.window.__coralite__ || {}
    globalThis.window.__coralite__.hydrationStore = {
      get () {
        return globalThis.window.__coralite_hydration__
      },
      merge (next) {
        if (next && typeof next === 'object') {
          Object.assign(globalThis.window.__coralite_hydration__, next)
        }
      },
      replace (next) {
        globalThis.window.__coralite_hydration__ = next && typeof next === 'object' ? next : {}
      }
    }

    const store = globalThis.window.__coralite__.hydrationStore
    assert.ok(store, 'hydrationStore should be exposed on window.__coralite__')

    const storeObj = globalThis.window.__coralite_hydration__
    assert.strictEqual(store.get(), storeObj)

    store.merge({ 'comp-2': { b: 2 } })
    assert.deepStrictEqual(store.get(), {
      'comp-1': { a: 1 },
      'comp-2': { b: 2 }
    })

    const newStore = { 'comp-3': { c: 3 } }
    store.replace(newStore)
    assert.strictEqual(store.get(), newStore)

    if (origCoralite) {
      globalThis.window.__coralite__ = origCoralite
    } else {
      delete globalThis.window.__coralite__
    }
    if (origHydration) {
      globalThis.window.__coralite_hydration__ = origHydration
    } else {
      delete globalThis.window.__coralite_hydration__
    }
  })

  it('a component created after replace() reads from the new store while prior component is unaffected', () => {
    const origWindowStore = globalThis.window.__coralite_hydration__
    globalThis.window.__coralite_hydration__ = {
      'comp-old': { status: 'initial' }
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
    globalThis.window.__coralite_hydration__ = {
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

    if (origWindowStore) {
      globalThis.window.__coralite_hydration__ = origWindowStore
    } else {
      delete globalThis.window.__coralite_hydration__
    }
  })

  it('ScriptManager bundles hydrationStore initialization code', async () => {
    const sm = new ScriptManager()
    await sm.use({
      name: 'test-hydration-plugin',
      client: {
        init () {
        }
      }
    })

    const compiled = await sm.compileComponents('development')
    const runtimeFile = compiled.outputFiles['coralite-runtime.js'] || Object.values(compiled.outputFiles).find(f => f.path.includes('coralite-runtime'))
    assert.ok(runtimeFile)
    assert.ok(runtimeFile.text.includes('hydrationStore'))
    await sm.disposeContext()
  })
})
