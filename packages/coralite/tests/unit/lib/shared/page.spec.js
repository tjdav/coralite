import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { definePage } from '../../../../lib/shared/page.js'

describe('page.js (definePage)', () => {
  it('should act as an identity function for page configuration options', () => {
    const pageConfig = {
      paths () {
        return [{ params: { id: '1' } }]
      },
      server () {
        return { title: 'Test Page' }
      }
    }

    const result = definePage(pageConfig)
    assert.strictEqual(result, pageConfig)
  })

  it('should default to empty object when called with no arguments', () => {
    const result = definePage()
    assert.deepStrictEqual(result, {})
  })
})
