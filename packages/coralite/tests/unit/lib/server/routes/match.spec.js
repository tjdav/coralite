import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchRoute } from '../../../../../lib/server/routes/match.js'

describe('matchRoute', () => {
  const routeTable = {
    patterns: [
      {
        pattern: '/about',
        params: [],
        segments: [{
          type: 'static',
          value: 'about'
        }],
        pagePath: '/pages/about.html',
        type: 'static'
      },
      {
        pattern: '/docs/api',
        params: [],
        segments: [
          {
            type: 'static',
            value: 'docs'
          },
          {
            type: 'static',
            value: 'api'
          }
        ],
        pagePath: '/pages/docs/api.html',
        type: 'static'
      },
      {
        pattern: '/docs/:slug',
        params: ['slug'],
        segments: [
          {
            type: 'static',
            value: 'docs'
          },
          {
            type: 'param',
            value: 'slug'
          }
        ],
        pagePath: '/pages/docs/[slug].html',
        type: 'dynamic'
      },
      {
        pattern: '/docs/:slug*',
        params: ['slug'],
        segments: [
          {
            type: 'static',
            value: 'docs'
          },
          {
            type: 'catchall',
            value: 'slug'
          }
        ],
        pagePath: '/pages/docs/[...slug].html',
        type: 'dynamic'
      },
      {
        pattern: '/posts/:id',
        params: ['id'],
        segments: [
          {
            type: 'static',
            value: 'posts'
          },
          {
            type: 'param',
            value: 'id'
          }
        ],
        pagePath: '/pages/posts/[id].html',
        type: 'dynamic'
      },
      {
        pattern: '/:section/:id',
        params: ['section', 'id'],
        segments: [
          {
            type: 'param',
            value: 'section'
          },
          {
            type: 'param',
            value: 'id'
          }
        ],
        pagePath: '/pages/[section]/[id].html',
        type: 'dynamic'
      },
      {
        pattern: '/a/b/:id',
        params: ['id'],
        segments: [
          {
            type: 'static',
            value: 'a'
          },
          {
            type: 'static',
            value: 'b'
          },
          {
            type: 'param',
            value: 'id'
          }
        ],
        pagePath: '/pages/a/b/[id].html',
        type: 'dynamic'
      },
      {
        pattern: '/a/:x/c',
        params: ['x'],
        segments: [
          {
            type: 'static',
            value: 'a'
          },
          {
            type: 'param',
            value: 'x'
          },
          {
            type: 'static',
            value: 'c'
          }
        ],
        pagePath: '/pages/a/[x]/c.html',
        type: 'dynamic'
      }
    ]
  }

  it('Static exact match beats param', () => {
    const res = matchRoute('/docs/api', routeTable)
    assert.strictEqual(res?.pattern, '/docs/api')
    assert.strictEqual(res?.pagePath, '/pages/docs/api.html')
  })

  it('Static exact match beats catch-all', () => {
    const res = matchRoute('/docs', routeTable)
    assert.strictEqual(res?.pattern, '/docs/:slug*')
    assert.deepEqual(res?.params, { slug: '' })
  })

  it('Param beats catch-all', () => {
    const res = matchRoute('/docs/intro', routeTable)
    assert.strictEqual(res?.pattern, '/docs/:slug')
    assert.deepEqual(res?.params, { slug: 'intro' })
  })

  it('Deeper pattern beats shallower with catch-all', () => {
    const res = matchRoute('/docs/api/v1', routeTable)
    assert.strictEqual(res?.pattern, '/docs/:slug*')
    assert.deepEqual(res?.params, { slug: 'api/v1' })
  })

  it('Longer static prefix beats shorter', () => {
    const res = matchRoute('/a/b/123', routeTable)
    assert.strictEqual(res?.pattern, '/a/b/:id')
    assert.deepEqual(res?.params, { id: '123' })
  })

  it('Left-to-right resolution at first diverging segment', () => {
    const res = matchRoute('/posts/intro', routeTable)
    assert.strictEqual(res?.pattern, '/posts/:id')
    assert.deepEqual(res?.params, { id: 'intro' })
  })

  it('Catch-all with empty match returns params: { slug: "" }', () => {
    const res = matchRoute('/docs', routeTable)
    assert.strictEqual(res?.pattern, '/docs/:slug*')
    assert.deepEqual(res?.params, { slug: '' })
  })

  it('Catch-all with multiple segments returns params: { slug: "a/b/c" }', () => {
    const res = matchRoute('/docs/a/b/c', routeTable)
    assert.strictEqual(res?.pattern, '/docs/:slug*')
    assert.deepEqual(res?.params, { slug: 'a/b/c' })
  })

  it('Query string and hash stripped before matching', () => {
    const res = matchRoute('/about?query=1#fragment', routeTable)
    assert.strictEqual(res?.pattern, '/about')
  })

  it('Trailing slash stripped before matching', () => {
    const res = matchRoute('/about/', routeTable)
    assert.strictEqual(res?.pattern, '/about')
  })

  it('Percent-encoding preserved', () => {
    const res = matchRoute('/docs/hello%20world', routeTable)
    assert.strictEqual(res?.pattern, '/docs/:slug')
    assert.deepEqual(res?.params, { slug: 'hello%20world' })
  })

  it('No match returns null', () => {
    const res = matchRoute('/nonexistent/path/extra', routeTable)
    assert.strictEqual(res, null)
  })
})
