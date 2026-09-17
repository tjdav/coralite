import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { kebabToCamel, camelToKebab, _clearStringConversionCaches } from '../../../lib/utils/core.js'

describe('Memoized String Conversions (kebabToCamel & camelToKebab)', () => {
  beforeEach(() => {
    _clearStringConversionCaches()
  })

  describe('kebabToCamel', () => {
    it('converts kebab-case and colon-separated strings to camelCase', () => {
      assert.strictEqual(kebabToCamel('foo-bar'), 'fooBar')
      assert.strictEqual(kebabToCamel('foo-bar-baz'), 'fooBarBaz')
      assert.strictEqual(kebabToCamel('attr:name'), 'attrName')
      assert.strictEqual(kebabToCamel('a-b-c'), 'aBC')
    })

    it('handles non-kebab single words identically', () => {
      assert.strictEqual(kebabToCamel('count'), 'count')
      assert.strictEqual(kebabToCamel('disabled'), 'disabled')
      assert.strictEqual(kebabToCamel('fooBar'), 'fooBar')
    })

    it('returns empty string for non-string or zero-length inputs', () => {
      // @ts-ignore
      assert.strictEqual(kebabToCamel(null), '')
      // @ts-ignore
      assert.strictEqual(kebabToCamel(undefined), '')
      // @ts-ignore
      assert.strictEqual(kebabToCamel(123), '')
      assert.strictEqual(kebabToCamel(''), '')
    })

    it('returns exact memoized string reference on repeated calls', () => {
      const first = kebabToCamel('some-long-attribute-name')
      const second = kebabToCamel('some-long-attribute-name')

      assert.strictEqual(first, 'someLongAttributeName')
      assert.strictEqual(first, second)
    })

    it('evicts oldest key using FIFO when cap of 1,000 items is reached', () => {
      kebabToCamel('first-key')

      for (let i = 0; i < 1000; i++) {
        kebabToCamel(`item-${i}-key`)
      }

      // 'first-key' should have been evicted from cache
      const reEvaluatedFirst = kebabToCamel('first-key')
      assert.strictEqual(reEvaluatedFirst, 'firstKey')
    })
  })

  describe('camelToKebab', () => {
    it('converts camelCase strings to kebab-case', () => {
      assert.strictEqual(camelToKebab('fooBar'), 'foo-bar')
      assert.strictEqual(camelToKebab('fooBarBaz'), 'foo-bar-baz')
      assert.strictEqual(camelToKebab('item1Name'), 'item1-name')
    })

    it('handles single lowercase words identically', () => {
      assert.strictEqual(camelToKebab('count'), 'count')
      assert.strictEqual(camelToKebab('disabled'), 'disabled')
      assert.strictEqual(camelToKebab('simple'), 'simple')
    })

    it('returns empty string for non-string or zero-length inputs', () => {
      // @ts-ignore
      assert.strictEqual(camelToKebab(null), '')
      // @ts-ignore
      assert.strictEqual(camelToKebab(undefined), '')
      // @ts-ignore
      assert.strictEqual(camelToKebab(456), '')
      assert.strictEqual(camelToKebab(''), '')
    })

    it('returns exact memoized string reference on repeated calls', () => {
      const first = camelToKebab('someLongPropertyName')
      const second = camelToKebab('someLongPropertyName')

      assert.strictEqual(first, 'some-long-property-name')
      assert.strictEqual(first, second)
    })

    it('evicts oldest key using FIFO when cap of 1,000 items is reached', () => {
      camelToKebab('firstKey')

      for (let i = 0; i < 1000; i++) {
        camelToKebab(`item${i}Key`)
      }

      // 'firstKey' should have been evicted from cache
      const reEvaluatedFirst = camelToKebab('firstKey')
      assert.strictEqual(reEvaluatedFirst, 'first-key')
    })
  })

  describe('_clearStringConversionCaches', () => {
    it('resets caches successfully', () => {
      const res1 = kebabToCamel('test-prop')
      const res2 = camelToKebab('testProp')

      _clearStringConversionCaches()

      assert.strictEqual(kebabToCamel('test-prop'), res1)
      assert.strictEqual(camelToKebab('testProp'), res2)
    })
  })
})
