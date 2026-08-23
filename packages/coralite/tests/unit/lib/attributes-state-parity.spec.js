import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'
import { createComponentDefinition } from '../../../lib/component-setup.js'

describe('State Key Parity & Reserved DOM Attribute Filtering (F1 & F2)', () => {
  it('Fix F1: omitted optional attributes without defaults are omitted from state in both SSR and client', async () => {
    const mockApp = { createComponentElement: () => null, options: {} }
    const defineComp = createComponentDefinition({ app: mockApp })

    // 1. SSR Check
    const ssrResult = await defineComp({
      attributes: {
        present: { type: String, default: 'yes' },
        omittedNoDefault: String
      }
    }, {
      state: {},
      module: { id: 'f1-comp', path: { pathname: '/f1.coral' } },
      root: null
    })

    const userKeys = Object.keys(ssrResult).filter(k => k !== '__script__')
    assert.deepEqual(userKeys, ['present'])
    assert.strictEqual(ssrResult.omittedNoDefault, undefined)

    // 2. Client Check
    const tagName = 'f1-client-' + Math.random().toString(36).substring(2, 9)
    const ClientComp = createCoraliteClass({
      componentId: 'f1-comp',
      attributes: {
        present: { type: String, default: 'yes' },
        omittedNoDefault: String
      }
    })
    customElements.define(tagName, ClientComp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.deepEqual(Object.keys(el._state), ['present'])
    assert.strictEqual(el._state.omittedNoDefault, undefined)

    document.body.removeChild(el)
  })

  it('Fix F2: filters RESERVED_DOM_ATTRIBUTES in client runtime unless explicitly declared', () => {
    const tagName = 'f2-client-' + Math.random().toString(36).substring(2, 9)
    const ClientComp = createCoraliteClass({
      componentId: 'f2-comp',
      attributes: {
        slot: String, // Explicitly declared reserved attribute
        title: String // Declared normal attribute
      }
    })
    customElements.define(tagName, ClientComp)

    const el = document.createElement(tagName)
    el.setAttribute('data-cid', 'my-comp-1')
    el.setAttribute('data-coralite-owner', 'owner-id')
    el.setAttribute('data-coralite-initial', '')
    el.setAttribute('data-coralite-slot-index', '0')
    el.setAttribute('data-coralite-page', '/index.html')
    el.setAttribute('data-style-selector', 'comp-style')
    el.setAttribute('slot', 'header')
    el.setAttribute('ref', 'btn-ref')
    el.setAttribute('data-testid', 'test-btn')
    el.setAttribute('no-hydration', '')
    el.setAttribute('title', 'My Title')
    el.setAttribute('custom-attr', 'hello')

    document.body.appendChild(el)

    // Reserved attributes that were not declared must not be in _state
    assert.strictEqual(el._state['dataCid'], undefined)
    assert.strictEqual(el._state['dataCoraliteOwner'], undefined)
    assert.strictEqual(el._state['dataCoraliteInitial'], undefined)
    assert.strictEqual(el._state['dataCoraliteSlotIndex'], undefined)
    assert.strictEqual(el._state['dataCoralitePage'], undefined)
    assert.strictEqual(el._state['dataStyleSelector'], undefined)
    assert.strictEqual(el._state['ref'], undefined)
    assert.strictEqual(el._state['dataTestid'], undefined)
    assert.strictEqual(el._state['noHydration'], undefined)

    // Explicitly declared reserved attribute 'slot' is allowed
    assert.strictEqual(el._state.slot, 'header')

    // Declared normal attribute
    assert.strictEqual(el._state.title, 'My Title')

    // Undeclared non-reserved DOM attribute passes through
    assert.strictEqual(el._state.customAttr, 'hello')

    document.body.removeChild(el)
  })
})
