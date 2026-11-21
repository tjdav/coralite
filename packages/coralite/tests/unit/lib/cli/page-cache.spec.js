import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createPageCache } from '../../../../lib/cli/page-cache.js'

describe('createPageCache', () => {
  it('evicts alias keys together', () => {
    const cache = createPageCache({ maxEntries: 1 })
    cache.set(['page.html', 'page/index.html'], { html: 'first' })
    cache.set(['other.html'], { html: 'second' })

    assert.equal(cache.get('page.html'), null)
    assert.equal(cache.get('page/index.html'), null)
    assert.deepEqual(cache.get('other.html'), { html: 'second' })
    assert.equal(cache.size, 1)
  })

  it('refreshes recency on get', () => {
    const cache = createPageCache({ maxEntries: 2 })
    cache.set(['a.html'], { html: 'a' })
    cache.set(['b.html'], { html: 'b' })
    cache.get('a.html')
    cache.set(['c.html'], { html: 'c' })

    assert.deepEqual(cache.get('a.html'), { html: 'a' })
    assert.equal(cache.get('b.html'), null)
    assert.deepEqual(cache.get('c.html'), { html: 'c' })
  })

  it('can disable caching with maxEntries 0', () => {
    const cache = createPageCache({ maxEntries: 0 })
    cache.set(['a.html'], { html: 'a' })

    assert.equal(cache.get('a.html'), null)
    assert.equal(cache.size, 0)
  })

  it('clears every alias and entry', () => {
    const cache = createPageCache({ maxEntries: 4 })
    cache.set(['a.html', 'a/index.html'], { html: 'a' })
    cache.set(['b.html'], { html: 'b' })
    cache.clear()

    assert.equal(cache.get('a.html'), null)
    assert.equal(cache.get('a/index.html'), null)
    assert.equal(cache.get('b.html'), null)
    assert.equal(cache.size, 0)
  })

  it('trims when maxEntries is reduced', () => {
    const cache = createPageCache({ maxEntries: 4 })
    cache.set(['a.html'], { html: 'a' })
    cache.set(['b.html'], { html: 'b' })
    cache.set(['c.html'], { html: 'c' })
    cache.setMaxEntries(1)

    assert.equal(cache.get('a.html'), null)
    assert.equal(cache.get('b.html'), null)
    assert.deepEqual(cache.get('c.html'), { html: 'c' })
    assert.equal(cache.size, 1)
  })
})
