import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeErrorCodes, matchesErrorCode } from 'coralite'

describe('normalizeErrorCodes', () => {
  it('handles null / undefined / empty input', () => {
    assert.strictEqual(normalizeErrorCodes(null), null)
    assert.strictEqual(normalizeErrorCodes(undefined), null)
    assert.strictEqual(normalizeErrorCodes(''), null)
  })

  it('normalizes single string error code', () => {
    const res = normalizeErrorCodes('E201')
    assert.ok(res instanceof Set)
    assert.strictEqual(res.size, 1)
    assert.ok(res.has('E201'))
  })

  it('normalizes comma-separated string error codes', () => {
    const res = normalizeErrorCodes('E201, E105, e102')
    assert.ok(res instanceof Set)
    assert.strictEqual(res.size, 3)
    assert.ok(res.has('E201'))
    assert.ok(res.has('E105'))
    assert.ok(res.has('E102'))
  })

  it('normalizes array of error codes', () => {
    const res = normalizeErrorCodes(['CORALITE-E201', 'e102'])
    assert.ok(res instanceof Set)
    assert.strictEqual(res.size, 2)
    assert.ok(res.has('CORALITE-E201'))
    assert.ok(res.has('E102'))
  })
})

describe('matchesErrorCode', () => {
  it('returns true when targetCodesSet is null or empty', () => {
    assert.strictEqual(matchesErrorCode('E201', null), true)
    assert.strictEqual(matchesErrorCode('E201', new Set()), true)
  })

  it('dual-matches E201 with CORALITE-E201 set target', () => {
    const set1 = normalizeErrorCodes('CORALITE-E201')
    assert.strictEqual(matchesErrorCode('E201', set1), true)
    assert.strictEqual(matchesErrorCode('CORALITE-E201', set1), true)

    const set2 = normalizeErrorCodes('E201')
    assert.strictEqual(matchesErrorCode('CORALITE-E201', set2), true)
    assert.strictEqual(matchesErrorCode('E201', set2), true)
  })

  it('preserves non-prefixed system codes', () => {
    const set = normalizeErrorCodes('SYNTAX_ERROR')
    assert.strictEqual(matchesErrorCode('SYNTAX_ERROR', set), true)
    assert.strictEqual(matchesErrorCode('E201', set), false)
  })
})
