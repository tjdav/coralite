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

  it('should validate namespaceExport is a string', () => {
    assert.doesNotThrow(() => {
      definePlugin({
        name: 'test',
        client: {
          imports: [{
            specifier: 'mod',
            namespaceExport: 'ns'
          }]
        }
      })
    })

    assert.throws(() => {
      definePlugin({
        name: 'test',
        client: {
          imports: [{
            specifier: 'mod',
            namespaceExport: 123
          }]
        }
      })
    }, /namespaceExport.*must be a string/)
  })

  it('should allow valid import combinations', () => {
    assert.doesNotThrow(() => {
      definePlugin({
        name: 'test',
        client: {
          imports: [{
            specifier: 'mod',
            defaultExport: 'def',
            namespaceExport: 'ns',
            namedExports: ['a', 'b as c']
          }]
        }
      })
    })
  })
})
