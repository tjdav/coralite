import '../setup.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { processHTML } from '../../../lib/utils/client/inject.js'

// Run sanitizeTokenAttributes through the processHTML fallback path
// (no window.processHTML, empty instanceId → no ref-prefixing side-effects)
function sanitize (html) {
  return processHTML(html, '')
}

describe('sanitizeTokenAttributes (via processHTML fallback)', () => {
  // === Pure-token attribute removal ===

  it('removes pure-token standard attribute', () => {
    assert.strictEqual(
      sanitize('<input pattern="{{ myPattern }}"/>'),
      '<input />'
    )
  })

  it('removes pure-token src attribute (prevents network request)', () => {
    assert.strictEqual(
      sanitize('<img src="{{ avatarUrl }}" alt="Avatar">'),
      '<img alt="Avatar">'
    )
  })

  it('removes pure-token boolean attribute (prevents forced truthiness)', () => {
    assert.strictEqual(
      sanitize('<button disabled="{{ isDisabled }}">Submit</button>'),
      '<button>Submit</button>'
    )
  })

  it('removes dot-path token attribute', () => {
    assert.strictEqual(
      sanitize('<a href="{{ page.url.pathname }}">Link</a>'),
      '<a>Link</a>'
    )
  })

  it('removes hyphenated token attribute', () => {
    assert.strictEqual(
      sanitize('<div data-id="{{ error_user-age }}"></div>'),
      '<div></div>'
    )
  })

  // === Mixed attribute handling ===

  it('retains static content in mixed attribute (double-space is harmless)', () => {
    assert.strictEqual(
      sanitize('<div class="btn {{ activeClass }} text-lg"></div>'),
      '<div class="btn  text-lg"></div>'
    )
  })

  // === Self-closing tags ===

  it('restores self-closing slash for SVG elements', () => {
    assert.strictEqual(
      sanitize('<circle cx="{{ x }}" cy="{{ y }}" r="10"/>'),
      '<circle r="10" />'
    )
  })

  // === Attribute value edge cases ===

  it('preserves non-token attributes containing special characters', () => {
    assert.strictEqual(
      sanitize('<div data-cond="count > 5" id="{{ id }}"></div>'),
      '<div data-cond="count > 5"></div>'
    )
  })

  // === Fast path ===

  it('passes through HTML with no tokens unchanged', () => {
    const html = '<span class="label">Static</span>'
    assert.strictEqual(sanitize(html), html)
  })

  // === Raw-text element protection (inner content only) ===

  it('does NOT sanitize tokens inside <script> inner content', () => {
    const html = '<script>const t = \'<div class="{{ x }}">\';</script>'
    assert.strictEqual(sanitize(html), html)
  })

  it('DOES sanitize attributes on <script> opening tag', () => {
    assert.strictEqual(
      sanitize('<script src="{{ url }}">console.log("ok");</script>'),
      '<script>console.log("ok");</script>'
    )
  })

  it('does NOT sanitize tokens inside HTML comments', () => {
    const html = '<!-- <div class="{{ x }}"></div> -->'
    assert.strictEqual(sanitize(html), html)
  })

  it('does NOT sanitize tokens inside <style> inner content', () => {
    const html = '<style>.foo::before { content: "{{ x }}"; }</style>'
    assert.strictEqual(sanitize(html), html)
  })

  it('does NOT sanitize tokens inside <textarea>', () => {
    const html = '<textarea>{{ placeholder }}</textarea>'
    assert.strictEqual(sanitize(html), html)
  })

  // === Tight token syntax ===

  it('handles tight token syntax without spaces', () => {
    assert.strictEqual(
      sanitize('<div class="{{languageClass}}"></div>'),
      '<div></div>'
    )
  })
})
