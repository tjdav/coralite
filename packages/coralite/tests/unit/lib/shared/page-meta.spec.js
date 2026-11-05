import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePageMetaDefaults } from '../../../../lib/shared/page-meta.js'

describe('page-meta.js (resolvePageMetaDefaults)', () => {
  it('resolves primitive default values into page state', () => {
    const defaults = resolvePageMetaDefaults({
      title: {
        type: String,
        default: 'Untitled'
      },
      count: {
        type: Number,
        default: 3
      },
      featured: {
        type: Boolean,
        default: true
      },
      campaign: {
        type: String,
        default: 'organic'
      }
    })

    assert.deepStrictEqual(defaults, {
      title: 'Untitled',
      count: 3,
      featured: true,
      campaign: 'organic'
    })
  })

  it('skips entries without a default', () => {
    const defaults = resolvePageMetaDefaults({
      title: { type: String },
      count: {
        type: Number,
        default: 0
      }
    })

    assert.deepStrictEqual(defaults, { count: 0 })
  })

  it('accepts shorthand type and values schemas without defaults', () => {
    const defaults = resolvePageMetaDefaults({
      title: String,
      count: Number,
      status: ['draft', 'published']
    })

    assert.deepStrictEqual(defaults, {})
  })

  it('applies validate functions to defaults', () => {
    const defaults = resolvePageMetaDefaults({
      slug: {
        type: String,
        default: 'Hello World',
        validate: value => value === 'Hello World'
      }
    })

    assert.strictEqual(defaults.slug, 'Hello World')
  })

  it('fails when a validate function rejects the default', () => {
    assert.throws(
      () => resolvePageMetaDefaults({
        slug: {
          type: String,
          default: 'nope',
          validate: value => value === 'yes'
        }
      }),
      (err) => {
        assert.match(err.message, /Page meta "slug" has an invalid default/)
        return true
      }
    )
  })

  it('fails when required is declared', () => {
    assert.throws(
      () => resolvePageMetaDefaults({
        title: {
          type: String,
          required: true
        }
      }),
      (err) => {
        assert.match(err.message, /cannot set "required"/)
        return true
      }
    )
  })

  it('fails when a Number default cannot be coerced', () => {
    assert.throws(
      () => resolvePageMetaDefaults({
        count: {
          type: Number,
          default: 'not-a-number'
        }
      }),
      (err) => {
        assert.match(err.message, /is not a valid Number/)
        return true
      }
    )
  })

  it('fails when a Boolean default is not boolean-like', () => {
    assert.throws(
      () => resolvePageMetaDefaults({
        featured: {
          type: Boolean,
          default: 'maybe'
        }
      }),
      (err) => {
        assert.match(err.message, /is not a valid Boolean/)
        return true
      }
    )
  })

  it('fails when a default is not in the allowed values', () => {
    assert.throws(
      () => resolvePageMetaDefaults({
        status: {
          values: ['draft', 'published'],
          default: 'archived'
        }
      }),
      (err) => {
        assert.match(err.message, /Expected one of/)
        return true
      }
    )
  })

  it('ignores non-object schema values', () => {
    const defaults = resolvePageMetaDefaults({
      title: 'not-a-schema',
      count: 42
    })

    assert.deepStrictEqual(defaults, {})
  })

  it('returns an empty object when meta is undefined', () => {
    assert.deepStrictEqual(resolvePageMetaDefaults(undefined), {})
  })

  it('throws when meta is not an object literal', () => {
    for (const invalid of [null, [], 'Untitled', 42]) {
      assert.throws(
        () => resolvePageMetaDefaults(invalid),
        (err) => {
          assert.match(err.message, /Page "meta" must be an object literal/)
          return true
        }
      )
    }
  })
})
