import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { validateSerializable } from '../../../../lib/utils/core.js'

describe('validateSerializable', () => {
  it('should not throw for primitives', () => {
    assert.doesNotThrow(() => validateSerializable(1))
    assert.doesNotThrow(() => validateSerializable('string'))
    assert.doesNotThrow(() => validateSerializable(true))
    assert.doesNotThrow(() => validateSerializable(null))
    assert.doesNotThrow(() => validateSerializable(undefined))
  })

  it('should not throw for plain objects and arrays', () => {
    assert.doesNotThrow(() => validateSerializable({
      a: 1,
      b: [2, 3]
    }))
  })

  it('should not throw for Date, RegExp, Map, Set', () => {
    assert.doesNotThrow(() => validateSerializable(new Date()))
    assert.doesNotThrow(() => validateSerializable(/abc/))
    assert.doesNotThrow(() => validateSerializable(new Map([['a', 1]])))
    assert.doesNotThrow(() => validateSerializable(new Set([1, 2])))
  })

  it('should throw for functions in objects', () => {
    assert.throws(() => {
      validateSerializable({
        a: 1,
        fn: () => {
        }
      })
    }, {
      name: 'CoraliteError',
      message: /Function detected at "root.fn"/
    })
  })

  it('should throw for functions in arrays', () => {
    assert.throws(() => {
      validateSerializable([1, () => {
      }])
    }, {
      name: 'CoraliteError',
      message: /Function detected at "root\[1\]"/
    })
  })

  it('should throw for functions in nested structures', () => {
    assert.throws(() => {
      validateSerializable({
        a: {
          b: [{
            c: () => {
            }
          }]
        }
      })
    }, {
      name: 'CoraliteError',
      message: /Function detected at "root.a.b\[0\].c"/
    })
  })

  it('should throw for functions in Map values', () => {
    assert.throws(() => {
      validateSerializable(new Map([['a', () => {
      }]]))
    }, {
      name: 'CoraliteError',
      message: /Function detected at "root.get\("a"\)"/
    })
  })

  it('should throw for functions in Set values', () => {
    assert.throws(() => {
      validateSerializable(new Set([() => {
      }]))
    }, {
      name: 'CoraliteError',
      message: /Function detected at "root.set\[0\]"/
    })
  })

  it('should handle circular references without infinite loop', () => {
    const obj = { a: 1 }
    obj.self = obj
    assert.doesNotThrow(() => validateSerializable(obj))
  })
})
