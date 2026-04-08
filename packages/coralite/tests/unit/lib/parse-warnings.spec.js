import { describe, it, mock } from 'node:test'
import { strict as assert } from 'node:assert'
import { parseHTML } from '../../../lib/parse.js'

describe('parseHTML warnings', () => {
  it('should call onError when an invalid custom element name is used', (t) => {
    const onError = t.mock.fn()
    const html = '<invalidname></invalidname>'

    parseHTML(html, undefined, undefined, onError)

    assert.strictEqual(onError.mock.callCount(), 1, 'Should have called onError for invalid custom element name')

    const call = onError.mock.calls[0]
    assert.strictEqual(call.arguments[0].level, 'WARN')
    assert.ok(call.arguments[0].message.includes('Invalid custom element tag name: "invalidname"'))
    assert.ok(call.arguments[0].message.includes('https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name'))
  })

  it('should call onError when a reserved custom element name is used', (t) => {
    const onError = t.mock.fn()
    const html = '<font-face></font-face>'

    try {
      parseHTML(html, undefined, undefined, onError)
    } catch (e) {
      assert.fail('parseHTML should not throw for reserved custom element names: ' + e.message)
    }

    assert.strictEqual(onError.mock.callCount(), 1, 'Should have called onError for reserved custom element name')

    const call = onError.mock.calls[0]
    assert.strictEqual(call.arguments[0].level, 'WARN')
    assert.ok(call.arguments[0].message.includes('Element name is reserved: "font-face"'))
    assert.ok(call.arguments[0].message.includes('https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name'))
    assert.ok(call.arguments[0].error instanceof Error)
  })

  it('should default to console.warn when onError is not provided', (t) => {
    const warnMock = t.mock.method(console, 'warn')
    const html = '<invalidname></invalidname>'

    parseHTML(html)

    // parseHTML internally uses console.warn if onError is not provided
    assert.strictEqual(warnMock.mock.callCount(), 1, 'Should have called console.warn when onError is missing')
  })

  it('should throw Error on ERR level in default handler', async (t) => {
    const Coralite = (await import('../../../lib/index.js')).default
    // We can't easily test Coralite's internal _defaultOnError via parseHTML default fallback
    // because parseHTML uses its own console.warn fallback if onError is not provided to it.
    // However, Coralite.prototype._handleError uses _defaultOnError
    // when not provided to the constructor.

    // Manual check of _defaultOnError behavior
    const coralite = new Coralite({
      components: 'tests/fixtures/components',
      pages: 'tests/fixtures/pages'
    })

    assert.throws(() => coralite._defaultOnError({
      level: 'ERR',
      message: 'test'
    }), /test/)
    const testErr = new Error('nested')
    assert.throws(() => coralite._defaultOnError({
      level: 'ERR',
      message: 'test',
      error: testErr
    }), (err) => err === testErr)
  })

  it('should not call onError for valid custom element names', (t) => {
    const onError = t.mock.fn()
    const html = '<my-component></my-component>'

    parseHTML(html, undefined, undefined, onError)

    assert.strictEqual(onError.mock.callCount(), 0, 'Should not have called onError for valid custom element name')
  })

  it('should not call onError for standard HTML tags', (t) => {
    const onError = t.mock.fn()
    const html = '<div></div>'

    parseHTML(html, undefined, undefined, onError)

    assert.strictEqual(onError.mock.callCount(), 0, 'Should not have called onError for standard HTML tag')
  })
})
