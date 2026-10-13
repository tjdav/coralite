import { describe, it } from 'node:test'
import assert from 'node:assert'
import { parsePagePattern } from '../../../../../lib/server/page/pattern.js'
import { CoraliteError } from '../../../../../lib/shared/errors.js'

describe('parsePagePattern', () => {
  it('parses index.html as root route', () => {
    const result = parsePagePattern('/app/pages/index.html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/',
      params: [],
      segments: []
    })
  })

  it('parses static page about.html', () => {
    const result = parsePagePattern('/app/pages/about.html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/about',
      params: [],
      segments: [
        {
          type: 'static',
          value: 'about'
        }
      ]
    })
  })

  it('parses posts/[post-id].html with hyphenated dynamic param', () => {
    const result = parsePagePattern('/app/pages/posts/[post-id].html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/posts/:post-id',
      params: ['post-id'],
      segments: [
        {
          type: 'static',
          value: 'posts'
        },
        {
          type: 'param',
          value: 'post-id'
        }
      ]
    })
  })

  it('parses blog/index.html stripping trailing index', () => {
    const result = parsePagePattern('/app/pages/blog/index.html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/blog',
      params: [],
      segments: [
        {
          type: 'static',
          value: 'blog'
        }
      ]
    })
  })

  it('parses posts/[id].html with dynamic param', () => {
    const result = parsePagePattern('/app/pages/posts/[id].html', '/app/pages')
    assert.deepStrictEqual(result, {
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
      ]
    })
  })

  it('parses posts/[id]/index.html stripping trailing index', () => {
    const result = parsePagePattern('/app/pages/posts/[id]/index.html', '/app/pages')
    assert.deepStrictEqual(result, {
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
      ]
    })
  })

  it('parses [year]/[month].html with multiple dynamic params', () => {
    const result = parsePagePattern('/app/pages/[year]/[month].html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/:year/:month',
      params: ['year', 'month'],
      segments: [
        {
          type: 'param',
          value: 'year'
        },
        {
          type: 'param',
          value: 'month'
        }
      ]
    })
  })

  it('parses blog/archive/[year]/index.html', () => {
    const result = parsePagePattern('/app/pages/blog/archive/[year]/index.html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/blog/archive/:year',
      params: ['year'],
      segments: [
        {
          type: 'static',
          value: 'blog'
        },
        {
          type: 'static',
          value: 'archive'
        },
        {
          type: 'param',
          value: 'year'
        }
      ]
    })
  })

  it('parses docs/[...slug].html producing catchall segment and :slug* pattern', () => {
    const result = parsePagePattern('/app/pages/docs/[...slug].html', '/app/pages')
    assert.deepStrictEqual(result, {
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
      ]
    })
  })

  it('parses [...slug].html at root producing catchall segment and /:slug* pattern', () => {
    const result = parsePagePattern('/app/pages/[...slug].html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/:slug*',
      params: ['slug'],
      segments: [
        {
          type: 'catchall',
          value: 'slug'
        }
      ]
    })
  })

  it('parses posts/[id]/[...rest].html producing param then catchall', () => {
    const result = parsePagePattern('/app/pages/posts/[id]/[...rest].html', '/app/pages')
    assert.deepStrictEqual(result, {
      pattern: '/posts/:id/:rest*',
      params: ['id', 'rest'],
      segments: [
        {
          type: 'static',
          value: 'posts'
        },
        {
          type: 'param',
          value: 'id'
        },
        {
          type: 'catchall',
          value: 'rest'
        }
      ]
    })
  })

  it('throws CoraliteError when pattern has multiple catch-all segments', () => {
    assert.throws(
      () => parsePagePattern('/app/pages/docs/[...a]/[...b].html', '/app/pages'),
      (err) => err instanceof CoraliteError && err.message.includes('at most one catch-all') && err.filePath === '/app/pages/docs/[...a]/[...b].html'
    )
  })

  it('throws CoraliteError when catch-all segment is not the last segment', () => {
    assert.throws(
      () => parsePagePattern('/app/pages/docs/[...slug]/extra.html', '/app/pages'),
      (err) => err instanceof CoraliteError && err.message.includes('must be the last segment') && err.filePath === '/app/pages/docs/[...slug]/extra.html'
    )

    assert.throws(
      () => parsePagePattern('/app/pages/docs/[...slug]/[id].html', '/app/pages'),
      (err) => err instanceof CoraliteError && err.message.includes('must be the last segment') && err.filePath === '/app/pages/docs/[...slug]/[id].html'
    )
  })

  it('normalizes leading ./ on relative paths', () => {
    const result = parsePagePattern('./posts/[id].html', '.')
    assert.deepStrictEqual(result, {
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
      ]
    })
  })

  it('normalizes Windows-style backslashes', () => {
    const result = parsePagePattern('C:\\app\\pages\\posts\\[id].html', 'C:\\app\\pages')
    assert.deepStrictEqual(result, {
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
      ]
    })
  })

  it('collapses multiple consecutive slashes', () => {
    const result = parsePagePattern('/app/pages//posts///[id].html', '/app/pages')
    assert.deepStrictEqual(result, {
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
      ]
    })
  })

  it('throws CoraliteError when segment contains malformed bracket expressions', () => {
    assert.throws(
      () => parsePagePattern('/app/pages/posts/invalid[id].html', '/app/pages'),
      (err) => err instanceof CoraliteError && err.message.includes('Malformed dynamic segment') && err.filePath === '/app/pages/posts/invalid[id].html'
    )

    assert.throws(
      () => parsePagePattern('/app/pages/posts/[id]foo.html', '/app/pages'),
      (err) => err instanceof CoraliteError && err.message.includes('Malformed dynamic segment')
    )

    assert.throws(
      () => parsePagePattern('/app/pages/posts/[].html', '/app/pages'),
      (err) => err instanceof CoraliteError && err.message.includes('Malformed dynamic segment')
    )
  })
})
