import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { parseHTML } from '../../../lib/utils/server/parse.js'
import { defaultOnError } from '../../../lib/utils/errors.js'

describe('parseHTML warnings', () => {
  it('should call onError when an invalid custom element name is used', (t) => {
    const onError = t.mock.fn()
    const html = '<invalid--name></invalid--name>'

    parseHTML(html, undefined, undefined, onError)

    assert.strictEqual(onError.mock.callCount(), 1, 'Should have called onError for invalid custom element name')

    const call = onError.mock.calls[0]
    assert.strictEqual(call.arguments[0].level, 'WARN')
    assert.ok(call.arguments[0].message.includes('Invalid custom element tag name: "invalid--name"'))
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
    const html = '<invalid--name></invalid--name>'

    parseHTML(html)

    // parseHTML internally uses console.warn if onError is not provided
    assert.strictEqual(warnMock.mock.callCount(), 1, 'Should have called console.warn when onError is missing')
  })

  it('should throw Error on ERR level in default handler', async () => {
    // Manual check of defaultOnError behavior
    assert.throws(() => defaultOnError({
      level: 'ERR',
      message: 'test'
    }), /test/)
    const testErr = new Error('nested')
    assert.throws(() => defaultOnError({
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
