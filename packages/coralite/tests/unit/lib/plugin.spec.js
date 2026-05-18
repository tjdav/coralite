import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'

describe('definePlugin', () => {
  it('should validate basic plugin state', () => {
    const plugin = definePlugin({
      name: 'test-plugin',
      exports: () => {
      }
    })

    assert.strictEqual(plugin.name, 'test-plugin')
    assert.strictEqual(typeof plugin.exports, 'function')
  })
})
