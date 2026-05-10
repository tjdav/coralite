import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { definePlugin } from '#lib'

describe('definePlugin', () => {
  it('should validate basic plugin properties', () => {
    const plugin = definePlugin({
      name: 'test-plugin',
      method: () => {
      }
    })

    assert.strictEqual(plugin.name, 'test-plugin')
    assert.strictEqual(typeof plugin.method, 'function')
  })
})
