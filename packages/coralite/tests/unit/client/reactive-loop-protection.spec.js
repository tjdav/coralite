import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/coralite-element.js'

describe('Reactive Loop Protection (Tier 1 & Tier 2)', () => {
  beforeEach(() => {
    window.__coralite__ = window.__coralite__ || {}
    window.__coralite__.mode = 'development'
  })

  it('Tier 1: Direct self-mutation is aborted in Dev mode with warning and error log', (t, done) => {
    let warningEmitted = null
    let errorLogged = null
    const origWarn = console.warn
    const origErr = console.error

    console.warn = (msg) => { warningEmitted = msg }
    console.error = (msg, err) => { errorLogged = { msg, err } }

    const tag = 't1-dev-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 't1-dev',
      defaultValues: { n: 10 },
      client ({ state, observe }) {
        observe('n', (val) => {
          state.n = val + 1
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Trigger mutation
      // @ts-ignore
      el._state.n = 20

      queueMicrotask(() => {
        console.warn = origWarn
        console.error = origErr

        assert.ok(warningEmitted, 'Should emit console.warn')
        assert.ok(warningEmitted.includes('Cyclic state mutation detected'), 'Warning message should explain cyclic mutation')
        assert.ok(errorLogged, 'Should log error via console.error')
        assert.strictEqual(errorLogged.msg, 'Coralite Observer Error:')
        // Mutation was aborted, value stays 20
        // @ts-ignore
        assert.strictEqual(el._state.n, 20)
        // @ts-ignore
        assert.strictEqual(el._isExecutingObserver, false, '_isExecutingObserver should be reset to false')

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('Tier 1: Direct self-mutation is aborted in Prod mode without warn or throw, emitting coralite-error event', (t, done) => {
    window.__coralite__.mode = 'production'

    let warningEmitted = null
    let errorLogged = null
    let customEventDetail = null

    const origWarn = console.warn
    const origErr = console.error

    console.warn = (msg) => { warningEmitted = msg }
    console.error = (msg, err) => { errorLogged = { msg, err } }

    const tag = 't1-prod-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 't1-prod',
      defaultValues: { count: 5 },
      client ({ state, observe }) {
        observe('count', (val) => {
          state.count = val + 1
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    el.addEventListener('coralite-error', (e) => {
      customEventDetail = e.detail
    })
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Trigger mutation
      // @ts-ignore
      el._state.count = 50

      queueMicrotask(() => {
        console.warn = origWarn
        console.error = origErr

        assert.strictEqual(warningEmitted, null, 'In prod mode, console.warn should NOT be emitted')
        assert.ok(errorLogged, 'In prod mode, console.error should be logged')
        assert.strictEqual(errorLogged.msg, 'Coralite Observer Error:')
        assert.ok(customEventDetail, 'coralite-error event should be dispatched')
        assert.ok(customEventDetail.error, 'event detail should contain error object')
        // @ts-ignore
        assert.strictEqual(el._state.count, 50, 'Mutation should be discarded')

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('Tier 1: All mutation traps are protected (set, deleteProperty, errors set, errors deleteProperty)', (t, done) => {
    const tag = 't1-traps-' + Math.random().toString(36).substring(2, 9)
    let deleteAttempted = false

    const Comp = createCoraliteClass({
      componentId: 't1-traps',
      defaultValues: {
        prop: 'hello'
      },
      client ({ state, observe }) {
        observe('prop', () => {
          if (!deleteAttempted) {
            deleteAttempted = true
            delete state.prop
          }
        })
        observe('errors', () => {
          state.errors.test = 'err'
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // @ts-ignore
      el._state.prop = 'world'

      queueMicrotask(() => {
        // @ts-ignore
        assert.strictEqual(el._state.prop, 'world', 'delete state.prop inside observe("prop") should be aborted')

        // Trigger errors observer
        // @ts-ignore
        el._state.errors.test = 'initial'

        queueMicrotask(() => {
          // @ts-ignore
          assert.strictEqual(el._state.errors.test, 'initial', 'state.errors mutation inside observe("errors") should be aborted')
          document.body.removeChild(el)
          done()
        })
      })
    })
  })

  it('Tier 1: Non-cyclic mutations (a -> b) are permitted and settle cleanly', (t, done) => {
    const tag = 't1-noncyclic-' + Math.random().toString(36).substring(2, 9)
    const Comp = createCoraliteClass({
      componentId: 't1-noncyclic',
      defaultValues: {
        dept: 'sales',
        employee: 'Alice'
      },
      client ({ state, observe }) {
        observe('dept', () => {
          state.employee = null
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Mutate dept
      // @ts-ignore
      el._state.dept = 'engineering'

      queueMicrotask(() => {
        // @ts-ignore
        assert.strictEqual(el._state.employee, null, 'Non-cyclic mutation state.employee = null should succeed')
        document.body.removeChild(el)
        done()
      })
    })
  })

  it('Tier 1: Async observer throws and rejected promises do not produce unhandled rejections', (t, done) => {
    const tag = 't1-async-' + Math.random().toString(36).substring(2, 9)
    let errorLogged = null
    const origErr = console.error
    console.error = (msg, err) => { errorLogged = { msg, err } }

    const Comp = createCoraliteClass({
      componentId: 't1-async',
      defaultValues: { x: 1 },
      client ({ state, observe }) {
        observe('x', async () => {
          throw new Error('Async observer failure')
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // @ts-ignore
      el._state.x = 2

      setTimeout(() => {
        console.error = origErr
        assert.ok(errorLogged, 'Async observer rejection should be caught and logged')
        assert.strictEqual(errorLogged.msg, 'Coralite Observer Error:')
        assert.strictEqual(errorLogged.err.message, 'Async observer failure')
        document.body.removeChild(el)
        done()
      }, 50)
    })
  })

  it('Tier 2: Indirect ping-pong cycle (a -> b -> a) trips depth breaker at 50, latches, renders final DOM, and resets on external mutation', (t, done) => {
    const tag = 't2-depth-' + Math.random().toString(36).substring(2, 9)
    let cascadeErrorLogged = null
    let errorEventFired = false

    const origErr = console.error
    console.error = (msg, err) => {
      if (msg === 'Coralite Reactive Cascade Error:') {
        cascadeErrorLogged = { msg, err }
      }
    }

    const Comp = createCoraliteClass({
      componentId: 't2-depth',
      templateHTML: '<div id="val">{{ a }}</div>',
      defaultValues: { a: 1, b: 1 },
      hydrationMap: {
        texts: [{ path: [0, 0], template: '{{ a }}' }]
      },
      client ({ state, observe }) {
        // Indirect loop: a -> b -> a
        observe('a', () => {
          state.b = state.a + 1
        })
        observe('b', () => {
          state.a = state.b + 1
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    el.addEventListener('coralite-error', () => {
      errorEventFired = true
    })
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Trigger indirect loop
      // @ts-ignore
      el._state.a = 2

      setTimeout(() => {
        console.error = origErr

        assert.ok(cascadeErrorLogged, 'Tier 2 cascade error should be logged')
        assert.ok(errorEventFired, 'coralite-error event should be dispatched')
        // @ts-ignore
        assert.strictEqual(el._cascadeBreakerTripped, true, '_cascadeBreakerTripped should be true')
        // @ts-ignore
        assert.strictEqual(el._reactiveLoopBroken, true, '_reactiveLoopBroken should be latched')

        // Final DOM updated
        const valDiv = el.querySelector('#val')
        assert.ok(valDiv)
        assert.notStrictEqual(valDiv.textContent, '', 'DOM should converge to settled value')

        // Reset test: External mutation resets latch
        // @ts-ignore
        el._state.a = 500
        // @ts-ignore
        assert.strictEqual(el._reactiveLoopBroken, false, 'External mutation should reset _reactiveLoopBroken')
        // @ts-ignore
        assert.strictEqual(el._cascadeBreakerTripped, false, 'External mutation should reset _cascadeBreakerTripped')

        document.body.removeChild(el)
        done()
      }, 100)
    })
  })

  it('Tier 2: Deferred microtask loop trips rate watchdog at 100 flushes', (t, done) => {
    const tag = 't2-rate-' + Math.random().toString(36).substring(2, 9)
    let cascadeErrorLogged = null

    const origErr = console.error
    console.error = (msg, err) => {
      if (msg === 'Coralite Reactive Cascade Error:') {
        cascadeErrorLogged = { msg, err }
      }
    }

    const Comp = createCoraliteClass({
      componentId: 't2-rate',
      defaultValues: { count: 0 },
      client ({ state, observe }) {
        observe('count', (val) => {
          queueMicrotask(() => {
            state.count = val + 1
          })
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Start deferred loop
      // @ts-ignore
      el._state.count = 1

      setTimeout(() => {
        console.error = origErr

        assert.ok(cascadeErrorLogged, 'Deferred loop should trip rate watchdog and log error')
        // @ts-ignore
        assert.strictEqual(el._reactiveLoopBroken, true, '_reactiveLoopBroken should be latched')

        document.body.removeChild(el)
        done()
      }, 150)
    })
  })

  it('Sibling Observers Isolation: Error in first observer does not prevent second observer from running', (t, done) => {
    const tag = 'sibling-obs-' + Math.random().toString(36).substring(2, 9)
    let secondObsRan = false

    const Comp = createCoraliteClass({
      componentId: 'sibling-obs',
      defaultValues: { score: 10 },
      client ({ state, observe }) {
        observe('score', () => {
          throw new Error('First observer fault')
        })
        observe('score', () => {
          secondObsRan = true
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // @ts-ignore
      el._state.score = 20

      queueMicrotask(() => {
        assert.strictEqual(secondObsRan, true, 'Second observer should run despite first observer throwing')
        document.body.removeChild(el)
        done()
      })
    })
  })
})
