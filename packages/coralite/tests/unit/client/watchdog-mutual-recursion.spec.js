import '../setup.js'
import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoraliteClass } from '../../../lib/client/element.js'

describe('Watchdog Mutual Recursion Protection', () => {
  beforeEach(() => {
    window.__coralite__ = window.__coralite__ || {}
    window.__coralite__.mode = 'development'
  })

  it('mutual observer recursion completes with warning', (_, done) => {
    const tag = 'mutual-rec-' + Math.random().toString(36).substring(2, 9)
    let warningEmitted = false
    const origWarn = console.warn
    console.warn = (msg) => {
      if (typeof msg === 'string' && msg.includes('State mutation detected inside an observe() callback')) {
        warningEmitted = true
      }
    }

    const Comp = createCoraliteClass({
      componentId: 'mutual-rec',
      defaultValues: {
        a: 1,
        b: 1
      },
      client ({ state, observe }) {
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
    document.body.appendChild(el)

    queueMicrotask(() => {
      // Trigger mutual recursion
      // @ts-ignore
      el._state.a = 2

      console.warn = origWarn
      assert.ok(warningEmitted, 'Should emit state mutation warning during mutual recursion')
      // @ts-ignore
      assert.strictEqual(el._reactiveLoopBroken, true, '_reactiveLoopBroken should be latched')

      document.body.removeChild(el)
      done()
    })
  })

  it('legitimate cross-key observation still works', (_, done) => {
    const tag = 'legit-cross-' + Math.random().toString(36).substring(2, 9)
    let obsARan = false
    let obsBRan = false

    const Comp = createCoraliteClass({
      componentId: 'legit-cross',
      defaultValues: {
        a: 1,
        b: 10
      },
      client ({ state, observe }) {
        observe('a', () => {
          obsARan = true
          state.b = 20
        })
        observe('b', () => {
          obsBRan = true
          // Observer B reads state.b but does NOT mutate state
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // @ts-ignore
      el._state.a = 2

      queueMicrotask(() => {
        assert.strictEqual(obsARan, true, 'Observer A should fire')
        assert.strictEqual(obsBRan, true, 'Observer B should fire on state.b mutation')
        // @ts-ignore
        assert.strictEqual(el._reactiveLoopBroken, false, 'Latch should NOT trip for legitimate cross-key observation')
        // @ts-ignore
        assert.strictEqual(el._state.b, 20, 'state.b should be updated to 20')

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('chained observer (3 hops) completes', (_, done) => {
    const tag = 'chained-obs-' + Math.random().toString(36).substring(2, 9)
    let obsARan = false
    let obsBRan = false
    let obsCRan = false

    const Comp = createCoraliteClass({
      componentId: 'chained-obs',
      defaultValues: {
        a: 1,
        b: 1,
        c: 1
      },
      client ({ state, observe }) {
        observe('a', () => {
          obsARan = true
          state.b = state.a + 1
        })
        observe('b', () => {
          obsBRan = true
          state.c = state.b + 1
        })
        observe('c', () => {
          obsCRan = true
          // Observer C does nothing
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // @ts-ignore
      el._state.a = 2

      queueMicrotask(() => {
        assert.strictEqual(obsARan, true, 'Observer A should fire')
        assert.strictEqual(obsBRan, true, 'Observer B should fire')
        assert.strictEqual(obsCRan, true, 'Observer C should fire')
        // @ts-ignore
        assert.strictEqual(el._reactiveLoopBroken, false, 'Latch should NOT trip for non-cyclic chain')
        // @ts-ignore
        assert.strictEqual(el._state.b, 3, 'state.b should be 3')
        // @ts-ignore
        assert.strictEqual(el._state.c, 4, 'state.c should be 4')

        document.body.removeChild(el)
        done()
      })
    })
  })

  it('single-observer recursion still breaks', (_, done) => {
    const tag = 'single-rec-' + Math.random().toString(36).substring(2, 9)
    let warningEmitted = false
    const origWarn = console.warn
    console.warn = (msg) => {
      if (typeof msg === 'string' && msg.includes('Cyclic state mutation detected')) {
        warningEmitted = true
      }
    }

    const Comp = createCoraliteClass({
      componentId: 'single-rec',
      defaultValues: { count: 0 },
      client ({ state, observe }) {
        observe('count', (val) => {
          state.count = val + 1
        })
      }
    })
    customElements.define(tag, Comp)

    const el = document.createElement(tag)
    document.body.appendChild(el)

    queueMicrotask(() => {
      // @ts-ignore
      el._state.count = 10

      queueMicrotask(() => {
        console.warn = origWarn
        assert.ok(warningEmitted, 'Should emit cyclic state mutation warning')
        // @ts-ignore
        assert.strictEqual(el._state.count, 10, 'Self-mutation inside observer should be aborted')

        document.body.removeChild(el)
        done()
      })
    })
  })
})
