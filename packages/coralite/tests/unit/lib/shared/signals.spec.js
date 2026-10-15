import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSignal,
  createComputed,
  createEffect
} from '../../../../lib/shared/signals.js'

describe('signal primitive', () => {
  describe('createSignal', () => {
    it('createSignal(0).value returns 0', () => {
      const sig = createSignal(0)
      assert.equal(sig.value, 0)
    })

    it('setting .value to a new value fires subscribers with (newValue, oldValue)', () => {
      const sig = createSignal(10)
      const calls = []
      sig.subscribe((next, prev) => {
        calls.push([next, prev])
      })

      sig.value = 20
      assert.deepEqual(calls, [[20, 10]])
    })

    it('setting .value to the same value does not fire subscribers', () => {
      const sig = createSignal(10)
      let count = 0
      sig.subscribe(() => {
        count++
      })

      sig.value = 10
      assert.equal(count, 0)
    })

    it('setting .value to NaN twice does not fire subscribers (Object.is semantics)', () => {
      const sig = createSignal(NaN)
      let count = 0
      sig.subscribe(() => {
        count++
      })

      sig.value = NaN
      assert.equal(count, 0)
    })

    it('subscribe() returns a dispose function that stops notifications', () => {
      const sig = createSignal(1)
      let count = 0
      const dispose = sig.subscribe(() => {
        count++
      })

      sig.value = 2
      assert.equal(count, 1)

      dispose()
      sig.value = 3
      assert.equal(count, 1)
    })

    it('multiple subscribers fire in registration order', () => {
      const sig = createSignal('a')
      const order = []

      sig.subscribe(() => {
        order.push('first')
      })
      sig.subscribe(() => {
        order.push('second')
      })

      sig.value = 'b'
      assert.deepEqual(order, ['first', 'second'])
    })
  })

  describe('createComputed', () => {
    it('createComputed(fn) does not run fn until .value is read', () => {
      let runs = 0
      const comp = createComputed(() => {
        runs++
        return 42
      })

      assert.equal(runs, 0)
      assert.equal(comp.value, 42)
      assert.equal(runs, 1)
    })

    it('createComputed(fn) caches the result between reads', () => {
      let runs = 0
      const count = createSignal(5)
      const doubled = createComputed(() => {
        runs++
        return count.value * 2
      })

      assert.equal(doubled.value, 10)
      assert.equal(doubled.value, 10)
      assert.equal(runs, 1)
    })

    it('createComputed(fn) re-runs when a dependency signal changes', () => {
      const count = createSignal(5)
      const doubled = createComputed(() => count.value * 2)

      assert.equal(doubled.value, 10)

      count.value = 10
      assert.equal(doubled.value, 20)
    })

    it('createComputed(fn) does not re-run when an unrelated signal changes', () => {
      let runs = 0
      const a = createSignal(1)
      const b = createSignal(2)

      const comp = createComputed(() => {
        runs++
        return a.value * 10
      })

      assert.equal(comp.value, 10)
      assert.equal(runs, 1)

      b.value = 99
      assert.equal(comp.value, 10)
      assert.equal(runs, 1)
    })

    it('createComputed propagates to subscribers only when its value changes', () => {
      const a = createSignal(1)
      // Always returns same output
      const comp = createComputed(() => {
        a.value
        return 'constant'
      })

      let effectRuns = 0
      createEffect(() => {
        comp.value
        effectRuns++
      })

      assert.equal(effectRuns, 1)

      a.value = 2
      // comp recalculated, value is still 'constant', effect should NOT re-run
      assert.equal(effectRuns, 1)
    })

    it('createComputed cycle detection throws CoraliteError', () => {
      let comp
      comp = createComputed(() => {
        return comp.value + 1
      })

      assert.throws(
        () => {
          comp.value
        },
        (err) => {
          return err.name === 'CoraliteError' || err.message.includes('Cyclic dependency')
        }
      )
    })
  })

  describe('createEffect', () => {
    it('createEffect(fn) runs immediately', () => {
      let ran = false
      createEffect(() => {
        ran = true
      })
      assert.equal(ran, true)
    })

    it('createEffect(fn) re-runs when a dependency signal changes', () => {
      const count = createSignal(0)
      const values = []

      createEffect(() => {
        values.push(count.value)
      })

      assert.deepEqual(values, [0])

      count.value = 1
      assert.deepEqual(values, [0, 1])
    })

    it('createEffect(fn) re-runs when a computed it reads re-runs', () => {
      const count = createSignal(2)
      const doubled = createComputed(() => count.value * 2)
      const values = []

      createEffect(() => {
        values.push(doubled.value)
      })

      assert.deepEqual(values, [4])

      count.value = 3
      assert.deepEqual(values, [4, 6])
    })

    it('disposing an effect stops further re-runs', () => {
      const count = createSignal(0)
      let runs = 0

      const dispose = createEffect(() => {
        count.value
        runs++
      })

      assert.equal(runs, 1)

      count.value = 1
      assert.equal(runs, 2)

      dispose()

      count.value = 2
      assert.equal(runs, 2)
    })

    it('nested effects and computeds track independently', () => {
      const a = createSignal(1)
      const b = createSignal(10)
      const log = []

      createEffect(() => {
        log.push(`outer:${a.value}`)
        createEffect(() => {
          log.push(`inner:${b.value}`)
        })
      })

      assert.deepEqual(log, ['outer:1', 'inner:10'])

      b.value = 20
      assert.deepEqual(log, ['outer:1', 'inner:10', 'inner:20'])

      a.value = 2
      // Re-running outer creates a new inner effect
      assert.deepEqual(log, ['outer:1', 'inner:10', 'inner:20', 'outer:2', 'inner:20'])
    })

    it('the primitive works in Node without a browser environment', () => {
      assert.equal(typeof window, 'undefined')
      const sig = createSignal('node')
      let val
      createEffect(() => {
        val = sig.value
      })
      assert.equal(val, 'node')
      sig.value = 'isomorphic'
      assert.equal(val, 'isomorphic')
    })
  })
})
