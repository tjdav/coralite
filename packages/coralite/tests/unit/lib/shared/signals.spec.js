/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { signal, computed, effect } from '#lib/shared/signals.js'

describe('signals primitive', () => {
  describe('signal', () => {
    it('signal(initialValue).value returns initialValue', () => {
      const count = signal(0)
      assert.strictEqual(count.value, 0)

      const str = signal('hello')
      assert.strictEqual(str.value, 'hello')
    })

    it('setting .value to a new value fires subscribers synchronously', () => {
      const count = signal(0)
      const values = []
      count.subscribe((newVal, oldVal) => {
        values.push([newVal, oldVal])
      })

      count.value = 5
      assert.deepStrictEqual(values, [[5, 0]])

      count.value = 10
      assert.deepStrictEqual(values, [[5, 0], [10, 5]])
    })

    it('setting .value to the same value does not fire subscribers', () => {
      const count = signal(5)
      let fired = 0
      count.subscribe(() => {
        fired++
      })

      count.value = 5
      assert.strictEqual(fired, 0)
    })

    it('setting .value to NaN twice does not fire subscribers (Object.is semantics)', () => {
      const nanSignal = signal(NaN)
      let fired = 0
      nanSignal.subscribe(() => {
        fired++
      })

      nanSignal.value = NaN
      assert.strictEqual(fired, 0)
    })

    it('subscribe() returns a dispose function that stops notifications', () => {
      const count = signal(0)
      let fired = 0
      const dispose = count.subscribe(() => {
        fired++
      })

      count.value = 1
      assert.strictEqual(fired, 1)

      dispose()
      count.value = 2
      assert.strictEqual(fired, 1)
    })

    it('multiple subscribers fire in registration order', () => {
      const count = signal(0)
      const order = []

      count.subscribe(() => order.push('sub1'))
      count.subscribe(() => order.push('sub2'))
      count.subscribe(() => order.push('sub3'))

      count.value = 1
      assert.deepStrictEqual(order, ['sub1', 'sub2', 'sub3'])
    })
  })

  describe('computed', () => {
    it('computed(fn) does not run fn until .value is read', () => {
      let runs = 0
      const count = signal(2)
      const doubled = computed(() => {
        runs++
        return count.value * 2
      })

      assert.strictEqual(runs, 0)
      assert.strictEqual(doubled.value, 4)
      assert.strictEqual(runs, 1)
    })

    it('computed(fn) caches the result between reads', () => {
      let runs = 0
      const count = signal(3)
      const tripled = computed(() => {
        runs++
        return count.value * 3
      })

      assert.strictEqual(tripled.value, 9)
      assert.strictEqual(tripled.value, 9)
      assert.strictEqual(tripled.value, 9)
      assert.strictEqual(runs, 1)
    })

    it('computed(fn) re-runs when a dependency signal changes', () => {
      let runs = 0
      const count = signal(1)
      const doubled = computed(() => {
        runs++
        return count.value * 2
      })

      assert.strictEqual(doubled.value, 2)
      assert.strictEqual(runs, 1)

      count.value = 5
      assert.strictEqual(doubled.value, 10)
      assert.strictEqual(runs, 2)
    })

    it('computed(fn) does not re-run when an unrelated signal changes', () => {
      let runs = 0
      const count = signal(1)
      const unrelated = signal(100)

      const doubled = computed(() => {
        runs++
        return count.value * 2
      })

      assert.strictEqual(doubled.value, 2)
      assert.strictEqual(runs, 1)

      unrelated.value = 200
      assert.strictEqual(doubled.value, 2)
      assert.strictEqual(runs, 1)
    })

    it('computed propagates to subscribers only when its value changes', () => {
      const count = signal(1)
      const isPositive = computed(() => count.value > 0)

      const values = []
      effect(() => {
        values.push(isPositive.value)
      })

      assert.deepStrictEqual(values, [true])

      count.value = 2
      assert.deepStrictEqual(values, [true])

      count.value = -1
      assert.deepStrictEqual(values, [true, false])
    })

    it('computed cycle detection throws when a computed reads itself', () => {
      let c
      c = computed(() => c.value + 1)

      assert.throws(() => {
        c.value
      }, { message: /Cyclic dependency detected in computed/ })
    })

    it('indirect cycle detection throws', () => {
      let c1, c2
      c1 = computed(() => c2.value + 1)
      c2 = computed(() => c1.value + 1)

      assert.throws(() => {
        c1.value
      }, { message: /Cyclic dependency detected in computed/ })
    })
  })

  describe('effect', () => {
    it('effect(fn) runs immediately', () => {
      let ran = false
      effect(() => {
        ran = true
      })
      assert.strictEqual(ran, true)
    })

    it('effect(fn) re-runs when a dependency signal changes', () => {
      const count = signal(0)
      const values = []

      effect(() => {
        values.push(count.value)
      })

      assert.deepStrictEqual(values, [0])

      count.value = 1
      assert.deepStrictEqual(values, [0, 1])

      count.value = 2
      assert.deepStrictEqual(values, [0, 1, 2])
    })

    it('effect(fn) re-runs when a computed it reads re-runs', () => {
      const count = signal(1)
      const doubled = computed(() => count.value * 2)
      const values = []

      effect(() => {
        values.push(doubled.value)
      })

      assert.deepStrictEqual(values, [2])

      count.value = 3
      assert.deepStrictEqual(values, [2, 6])
    })

    it('disposing an effect stops further re-runs', () => {
      const count = signal(0)
      const values = []

      const dispose = effect(() => {
        values.push(count.value)
      })

      assert.deepStrictEqual(values, [0])

      count.value = 1
      assert.deepStrictEqual(values, [0, 1])

      dispose()
      count.value = 2
      assert.deepStrictEqual(values, [0, 1])
    })

    it('nested effects and computeds track independently', () => {
      const s1 = signal('a')
      const s2 = signal('b')
      const outerValues = []
      const innerValues = []

      effect(() => {
        outerValues.push(s1.value)
        effect(() => {
          innerValues.push(s2.value)
        })
      })

      assert.deepStrictEqual(outerValues, ['a'])
      assert.deepStrictEqual(innerValues, ['b'])

      s2.value = 'bb'
      assert.deepStrictEqual(outerValues, ['a'])
      assert.deepStrictEqual(innerValues, ['b', 'bb'])

      s1.value = 'aa'
      assert.deepStrictEqual(outerValues, ['a', 'aa'])
      assert.deepStrictEqual(innerValues, ['b', 'bb', 'bb'])
    })

    it('dynamic dependency tracking cleans up stale dependencies', () => {
      const toggle = signal(true)
      const a = signal('A')
      const b = signal('B')
      const values = []

      effect(() => {
        if (toggle.value) {
          values.push(a.value)
        } else {
          values.push(b.value)
        }
      })

      assert.deepStrictEqual(values, ['A'])

      a.value = 'A2'
      assert.deepStrictEqual(values, ['A', 'A2'])

      b.value = 'B2'
      assert.deepStrictEqual(values, ['A', 'A2'])

      toggle.value = false
      assert.deepStrictEqual(values, ['A', 'A2', 'B2'])

      a.value = 'A3'
      assert.deepStrictEqual(values, ['A', 'A2', 'B2'])

      b.value = 'B3'
      assert.deepStrictEqual(values, ['A', 'A2', 'B2', 'B3'])
    })
  })

  describe('environment and purity', () => {
    it('works in Node environment without browser globals', () => {
      assert.strictEqual(typeof window, 'undefined')
      assert.strictEqual(typeof document, 'undefined')

      const count = signal(10)
      const sq = computed(() => count.value * count.value)
      let logVal
      effect(() => {
        logVal = sq.value
      })

      assert.strictEqual(logVal, 100)
      count.value = 5
      assert.strictEqual(logVal, 25)
    })
  })
})
