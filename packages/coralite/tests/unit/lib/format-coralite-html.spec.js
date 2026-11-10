import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatCoraliteHTML } from '../../../lib/client/utils/inject.js'

describe('formatCoraliteHTML', () => {
  describe('quoted > in attribute values', () => {
    it('prefixes ref and stamps owner after a quoted > attribute', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title="a > b" ref="x"></div>', 'inst', true),
        '<div title="a > b" ref="inst__x" data-coralite-owner="inst"></div>'
      )
    })

    it('strips data-testid after a quoted > attribute', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title="a > b" data-testid="foo">x</div>', 'inst', true),
        '<div title="a > b">x</div>'
      )
    })

    it('strips deprecated test after a quoted > attribute', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title="a > b" test="old">x</div>', 'inst', true),
        '<div title="a > b">x</div>'
      )
    })

    it('preserves data-testid in development mode after a quoted > attribute', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title="a > b" data-testid="foo">x</div>', 'inst', false),
        '<div title="a > b" data-testid="foo">x</div>'
      )
    })
  })

  describe('attribute names inside attribute values', () => {
    it('does not strip test text inside another attribute value', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title=\'has test="x" inside\'>Hi</div>', 'inst', true),
        '<div title=\'has test="x" inside\'>Hi</div>'
      )
    })

    it('does not strip data-testid text inside another attribute value', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title=\'has data-testid="inside" inside\'>Hi</div>', 'inst', true),
        '<div title=\'has data-testid="inside" inside\'>Hi</div>'
      )
    })

    it('does not prefix ref text inside another attribute value', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title=\'has ref="inner" inside\'>Hi</div>', 'inst', true),
        '<div title=\'has ref="inner" inside\'>Hi</div>'
      )
    })

    it('does not treat owner text inside another attribute value as an owner attribute', () => {
      assert.strictEqual(
        formatCoraliteHTML('<div title=\'has data-coralite-owner="x" inside\' ref="real">Hi</div>', 'inst', true),
        '<div title=\'has data-coralite-owner="x" inside\' ref="inst__real" data-coralite-owner="inst">Hi</div>'
      )
    })
  })

  describe('raw-text elements and comments', () => {
    it('does not rewrite ref attributes inside script content', () => {
      const html = '<script>const t = \'<button ref="x">Go</button>\'</script>'
      assert.strictEqual(formatCoraliteHTML(html, 'inst', true), html)
    })

    it('does not rewrite ref attributes inside style content', () => {
      const html = '<style>.x::before { content: \'<button ref="x">\'; }</style>'
      assert.strictEqual(formatCoraliteHTML(html, 'inst', true), html)
    })

    it('does not rewrite ref attributes inside textarea content', () => {
      const html = '<textarea><button ref="x">Go</button></textarea>'
      assert.strictEqual(formatCoraliteHTML(html, 'inst', true), html)
    })

    it('does not rewrite ref attributes inside title content', () => {
      const html = '<title><button ref="x">Go</button></title>'
      assert.strictEqual(formatCoraliteHTML(html, 'inst', true), html)
    })

    it('does not rewrite ref attributes inside comments', () => {
      const html = '<!-- <button ref="x">Go</button> -->'
      assert.strictEqual(formatCoraliteHTML(html, 'inst', true), html)
    })

    it('does not rewrite ref attributes inside unclosed comments', () => {
      const html = '<!-- <button ref="x">Go</button>'
      assert.strictEqual(formatCoraliteHTML(html, 'inst', true), html)
    })
  })

  describe('attribute value forms', () => {
    it('prefixes unquoted ref values', () => {
      assert.strictEqual(
        formatCoraliteHTML('<button ref=x>Go</button>', 'inst', true),
        '<button ref="inst__x" data-coralite-owner="inst">Go</button>'
      )
    })

    it('prefixes uppercase REF attributes', () => {
      assert.strictEqual(
        formatCoraliteHTML('<BUTTON REF="x">Go</BUTTON>', 'inst', true),
        '<BUTTON ref="inst__x" data-coralite-owner="inst">Go</BUTTON>'
      )
    })

    it('preserves self-closing syntax', () => {
      assert.strictEqual(
        formatCoraliteHTML('<input ref="x" />', 'inst', true),
        '<input ref="inst__x" data-coralite-owner="inst" />'
      )
    })

    it('does not duplicate an existing owner attribute', () => {
      assert.strictEqual(
        formatCoraliteHTML('<button ref="x" data-coralite-owner="other">Go</button>', 'inst', true),
        '<button ref="inst__x" data-coralite-owner="other">Go</button>'
      )
    })

    it('adds the owner when the ref is already prefixed', () => {
      assert.strictEqual(
        formatCoraliteHTML('<button ref="inst__x">Go</button>', 'inst', true),
        '<button ref="inst__x" data-coralite-owner="inst">Go</button>'
      )
    })

    it('leaves refs untouched when no instance ID is provided', () => {
      const html = '<button ref="x">Go</button>'
      assert.strictEqual(formatCoraliteHTML(html, '', true), html)
    })
  })
})
