import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import { calculateSRIDigest } from '../../../lib/utils/server/csp.js'
import { CoraliteError } from '../../../lib/utils/errors.js'

describe('SRI Digest Calculation', () => {
  test('calculates sha384 digest by default for string content', () => {
    const content = 'console.log("hello world");'
    const digest = calculateSRIDigest(content)
    assert.match(digest, /^sha384-[A-Za-z0-9+/=]+$/)
  })

  test('calculates digest for Buffer content', () => {
    const buffer = Buffer.from('body { color: red; }', 'utf8')
    const digest = calculateSRIDigest(buffer, 'sha256')
    assert.match(digest, /^sha256-[A-Za-z0-9+/=]+$/)
  })

  test('supports sha256, sha384, sha512 algorithms', () => {
    const content = 'test content'
    assert.match(calculateSRIDigest(content, 'sha256'), /^sha256-/)
    assert.match(calculateSRIDigest(content, 'sha384'), /^sha384-/)
    assert.match(calculateSRIDigest(content, 'sha512'), /^sha512-/)
  })

  test('throws CoraliteError on unsupported algorithm', () => {
    assert.throws(() => {
      calculateSRIDigest('content', 'md5')
    }, (err) => {
      return err instanceof CoraliteError && err.message.includes('Invalid SRI hash algorithm')
    })
  })

  test('returns empty string for non-string / non-Buffer content', () => {
    assert.equal(calculateSRIDigest(null), '')
    assert.equal(calculateSRIDigest(undefined), '')
    assert.equal(calculateSRIDigest(123), '')
  })
})
