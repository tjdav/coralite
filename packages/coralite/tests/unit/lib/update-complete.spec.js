import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'

describe('updateComplete Contract', () => {
  let tagName

  beforeEach(() => {
    tagName = 'comp-uc-' + Math.random().toString(36).substring(2, 9)
  })

  it('1. Idle Element Fast-Path: returns immediately resolved Promise.resolve(true)', async () => {
    const Comp = createCoraliteClass({
      componentId: 'idle-comp',
      templateHTML: '<div><span id="text">{{ msg }}</span></div>',
      defaultValues: { msg: 'idle' },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ msg }}' }]
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    const res = await el.updateComplete
    assert.strictEqual(res, true)
    assert.strictEqual(el._updateCompleteResolvers, null)

    document.body.removeChild(el)
  })

  it('2. Behavioral Single State Mutation: resolves true when DOM is updated', async () => {
    const Comp = createCoraliteClass({
      componentId: 'single-mutate',
      templateHTML: '<div><span id="text">{{ message }}</span></div>',
      defaultValues: { message: 'hello' },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ message }}' }]
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    assert.strictEqual(el.querySelector('#text').textContent, 'hello')

    // Mutate state synchronously
    el._state.message = 'updated'

    // Synchronously before flush, DOM still reflects previous value
    assert.strictEqual(el.querySelector('#text').textContent, 'hello')

    // Await completion
    const res = await el.updateComplete
    assert.strictEqual(res, true)
    assert.strictEqual(el.querySelector('#text').textContent, 'updated')

    document.body.removeChild(el)
  })

  it('3. Public Declared Attribute Accessor: property mutation flushes DOM and resolves updateComplete', async () => {
    const Comp = createCoraliteClass({
      componentId: 'attr-prop',
      templateHTML: '<div><span id="text">{{ message }}</span></div>',
      defaultValues: { message: 'initial' },
      attributes: {
        message: { type: String }
      },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ message }}' }]
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Set via property accessor
    el.message = 'via-prop'
    assert.strictEqual(el.querySelector('#text').textContent, 'initial')

    const res = await el.updateComplete
    assert.strictEqual(res, true)
    assert.strictEqual(el.querySelector('#text').textContent, 'via-prop')

    document.body.removeChild(el)
  })

  it('4. Interleaved & Concurrent Awaits: multiple listeners receive true for same batch and subsequent updates', async () => {
    const Comp = createCoraliteClass({
      componentId: 'concurrent-uc',
      templateHTML: '<div><span id="cnt">{{ count }}</span></div>',
      defaultValues: { count: 0 },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ count }}' }]
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    el._state.count = 1

    const [p1, p2] = await Promise.all([el.updateComplete, el.updateComplete])
    assert.strictEqual(p1, true)
    assert.strictEqual(p2, true)
    assert.strictEqual(el.querySelector('#cnt').textContent, '1')

    // Subsequent sequential update
    el._state.count = 2
    const res = await el.updateComplete
    assert.strictEqual(res, true)
    assert.strictEqual(el.querySelector('#cnt').textContent, '2')

    document.body.removeChild(el)
  })

  it('5. Cascading Reactive Updates: stays pending until all observer cascade turns settle', async () => {
    const Comp = createCoraliteClass({
      componentId: 'cascade-uc',
      templateHTML: '<div><span id="s1">{{ step1 }}</span> - <span id="s2">{{ step2 }}</span></div>',
      defaultValues: { step1: 'a', step2: 'a-chained' },
      hydrationMap: {
        texts: [
          { path: [0, 0, 0], template: '{{ step1 }}' },
          { path: [0, 2, 0], template: '{{ step2 }}' }
        ]
      },
      client: ({ observe, state }) => {
        observe('step1', (val) => {
          state.step2 = val + '-chained'
        })
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Trigger cascade
    el._state.step1 = 'b'

    const updatePromise = el.updateComplete

    const res = await updatePromise
    assert.strictEqual(res, true)
    assert.strictEqual(el.querySelector('#s1').textContent, 'b')
    assert.strictEqual(el.querySelector('#s2').textContent, 'b-chained')

    document.body.removeChild(el)
  })

  it('6. Re-entrant Access during _isFlushing: observer querying updateComplete receives promise that resolves true on current flush end', async () => {
    let reentrantResult = null

    const Comp = createCoraliteClass({
      componentId: 'reentrant-uc',
      templateHTML: '<div><span id="val">{{ num }}</span></div>',
      defaultValues: { num: 10 },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ num }}' }]
      },
      client: ({ observe, updateComplete }) => {
        observe('num', async () => {
          reentrantResult = await updateComplete
        })
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    el._state.num = 20

    const res = await el.updateComplete
    assert.strictEqual(res, true)
    assert.strictEqual(el.querySelector('#val').textContent, '20')

    // Wait microtask for observer async function to finish setting reentrantResult
    await new Promise(resolve => queueMicrotask(resolve))
    assert.strictEqual(reentrantResult, true)

    document.body.removeChild(el)
  })

  it('7. Elided Update (No Bindings / No Dirty Observers): resolves true immediately', async () => {
    const Comp = createCoraliteClass({
      componentId: 'elided-uc',
      templateHTML: '<div>Static</div>',
      defaultValues: { unrendered: 'foo' }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Mutate property with no bindings or dirty observers
    el._state.unrendered = 'bar'

    // _scheduleUpdate returns early, el._isUpdatePending is false
    assert.strictEqual(el._isUpdatePending, false)

    const res = await el.updateComplete
    assert.strictEqual(res, true)

    document.body.removeChild(el)
  })

  it('8. Disconnection Safety: pending resolvers resolve false upon element removal', async () => {
    const Comp = createCoraliteClass({
      componentId: 'disconnect-uc',
      templateHTML: '<div><span id="txt">{{ val }}</span></div>',
      defaultValues: { val: 'a' },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ val }}' }]
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    el._state.val = 'b'
    const updatePromise = el.updateComplete

    // Remove element before microtask flushes
    document.body.removeChild(el)

    const res = await updatePromise
    assert.strictEqual(res, false)
    assert.strictEqual(el._updateCompleteResolvers, null)
  })

  it('9. Cascade Breaker Safety: resolves false when infinite reactivity loop trips breaker', async () => {
    const prevMode = window.__coralite__?.mode
    window.__coralite__ = window.__coralite__ || {}
    window.__coralite__.mode = 'production' // avoid throw in dev mode to test circuit breaker return

    let cascadeErrorEmitted = false

    const Comp = createCoraliteClass({
      componentId: 'cascade-breaker-uc',
      templateHTML: '<div><span id="txt">{{ ping }}</span></div>',
      defaultValues: { ping: 0, pong: 0 },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ ping }}' }]
      },
      client: ({ observe, state }) => {
        // Cyclic mutation between ping and pong
        observe('ping', (val) => {
          state.pong = val + 1
        })
        observe('pong', (val) => {
          state.ping = val + 1
        })
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    el.addEventListener('coralite-error', () => {
      cascadeErrorEmitted = true
    })
    document.body.appendChild(el)

    // Trigger cascade
    el._state.ping = 1

    const updatePromise = el.updateComplete

    const res = await updatePromise
    assert.strictEqual(res, false)
    assert.strictEqual(cascadeErrorEmitted, true)

    window.__coralite__.mode = prevMode
    document.body.removeChild(el)
  })

  it('10. Client Context Exposure: updateComplete is accessible and awaitable inside client controller', async () => {
    let clientAwaitedResult = null

    const Comp = createCoraliteClass({
      componentId: 'client-ctx-uc',
      templateHTML: '<div><span id="txt">{{ msg }}</span></div>',
      defaultValues: { msg: 'start' },
      hydrationMap: {
        texts: [{ path: [0, 0, 0], template: '{{ msg }}' }]
      },
      client: async ({ state, updateComplete }) => {
        state.msg = 'changed in client'
        clientAwaitedResult = await updateComplete
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    const res = await el.updateComplete
    assert.strictEqual(res, true)
    assert.strictEqual(clientAwaitedResult, true)
    assert.strictEqual(el.querySelector('#txt').textContent, 'changed in client')

    document.body.removeChild(el)
  })

  it('11. Async Getter Boundary Pinning: updateComplete resolves true on current flush end without hanging or blocking on pending async getter Promises', async () => {
    let getterPromiseResolve
    const asyncGetterPromise = new Promise(resolve => {
      getterPromiseResolve = resolve
    })

    const Comp = createCoraliteClass({
      componentId: 'async-getter-boundary',
      templateHTML: '<div><span id="async">{{ asyncVal }}</span></div>',
      getters: {
        asyncVal () {
          return asyncGetterPromise
        }
      },
      hydrationMap: {
        texts: [
          { path: [0, 0, 0], template: '{{ asyncVal }}' }
        ]
      }
    })
    customElements.define(tagName, Comp)

    const el = document.createElement(tagName)
    document.body.appendChild(el)

    // Trigger update
    el._scheduleUpdate()

    // updateComplete resolves true for the flush pass without blocking on pending asyncGetterPromise
    const res = await el.updateComplete
    assert.strictEqual(res, true)
    // Until async getter resolves, DOM has not applied the async token binding
    assert.strictEqual(el.querySelector('#async').textContent, '{{ asyncVal }}')

    // Later when the async getter resolves, bindings apply
    getterPromiseResolve('async-resolved')
    await asyncGetterPromise
    await new Promise(resolve => queueMicrotask(resolve))

    assert.strictEqual(el.querySelector('#async').textContent, 'async-resolved')

    document.body.removeChild(el)
  })
})
