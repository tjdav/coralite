import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createPlugin } from '#lib'

describe('createPlugin', () => {
  it('should validate basic plugin properties', () => {
    const plugin = createPlugin({
      name: 'test-plugin',
      method: () => {
      }
    })

    assert.strictEqual(plugin.name, 'test-plugin')
    assert.strictEqual(typeof plugin.method, 'function')
  })

  it('should validate namespaceExport is a string', () => {
    assert.doesNotThrow(() => {
      createPlugin({
        name: 'test',
        script: {
          imports: [{
            specifier: 'mod',
            namespaceExport: 'ns'
          }]
        }
      })
    })

    assert.throws(() => {
      createPlugin({
        name: 'test',
        script: {
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
      createPlugin({
        name: 'test',
        script: {
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
