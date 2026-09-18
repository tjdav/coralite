import '../setup.js'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { coerce } from '../../../lib/coralite-element.js'

describe('coerce', () => {
  it('should handle null and undefined', () => {
    assert.strictEqual(coerce(null, String), null)
    assert.strictEqual(coerce(undefined, String), undefined)
  })

  it('should coerce to Number', () => {
    assert.strictEqual(coerce('123', Number), 123)
    assert.strictEqual(coerce('123', 'Number'), 123)
    assert.strictEqual(coerce('abc', Number), null)
    assert.strictEqual(coerce('   ', Number), null)
    assert.strictEqual(coerce(Number.NaN, Number), null)
  })

  it('should coerce to Boolean', () => {
    assert.strictEqual(coerce('', Boolean), true)
    assert.strictEqual(coerce('true', Boolean), true)
    assert.strictEqual(coerce('false', Boolean), false)
    assert.strictEqual(coerce(null, Boolean), false)
    assert.strictEqual(coerce('null', Boolean), false)
    assert.strictEqual(coerce('anything', 'Boolean'), 'anything')
  })

  it('should reject template tokens for non-String targets', () => {
    assert.strictEqual(coerce('{{ title }}', Number), null)
    // Boolean has its own string passthrough above the token guard,
    // so token strings survive there but are blocked for Number.
    assert.strictEqual(coerce('{{ flag }}', Boolean), '{{ flag }}')
    assert.strictEqual(coerce('{{ title }}', String), '{{ title }}')
  })

  it('should coerce to String', () => {
    assert.strictEqual(coerce(123, String), '123')
    assert.strictEqual(coerce(true, 'String'), 'true')
  })

  it('should return value as-is for unknown type', () => {
    assert.strictEqual(coerce('val', Array), 'val')
  })
})
