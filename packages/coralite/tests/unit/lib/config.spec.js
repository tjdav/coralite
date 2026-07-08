/**
 * Tests for config.js
 */

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { defineConfig } from '../../../lib/config.js'

describe('config.js', () => {
  describe('defineConfig', () => {
    it('should return valid config unchanged', () => {
      const validConfig = {
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: []
      }

      const result = defineConfig(validConfig)
      assert.deepStrictEqual(result, validConfig)
    })

    it('should return valid config without plugins', () => {
      const validConfig = {
        output: './dist',
        components: './components',
        pages: './pages'
      }

      const result = defineConfig(validConfig)
      assert.deepStrictEqual(result, validConfig)
    })

    it('should throw error when config is not an object', () => {
      assert.throws(() => defineConfig(null), /Config must be an object/)
      assert.throws(() => defineConfig(undefined), /Config must be an object/)
      assert.throws(() => defineConfig('string'), /Config must be an object/)
      assert.throws(() => defineConfig(123), /Config must be an object/)
    })

    it('should throw error when missing required property', () => {
      assert.throws(() => defineConfig({
        components: './components',
        pages: './pages'
      }), /Missing required config property: "output"/)

      assert.throws(() => defineConfig({
        output: './dist',
        pages: './pages'
      }), /Missing required config property: "components"/)

      assert.throws(() => defineConfig({
        output: './dist',
        components: './components'
      }), /Missing required config property: "pages"/)
    })

    it('should throw error when required property is not a string', () => {
      assert.throws(() => defineConfig({
        output: 123,
        components: './components',
        pages: './pages'
      }), /Config property "output" must be a string, received number/)

      assert.throws(() => defineConfig({
        output: './dist',
        components: {},
        pages: './pages'
      }), /Config property "components" must be a string, received object/)

      assert.throws(() => defineConfig({
        output: './dist',
        components: './components',
        pages: []
      }), /Config property "pages" must be a string, received object/)
    })

    it('should throw error when required property is empty string', () => {
      assert.throws(() => defineConfig({
        output: '   ',
        components: './components',
        pages: './pages'
      }), /Config property "output" cannot be empty/)

      assert.throws(() => defineConfig({
        output: './dist',
        components: '',
        pages: './pages'
      }), /Config property "components" cannot be empty/)
    })

    it('should throw error when plugins is not an array', () => {
      assert.throws(() => defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: 'not-an-array'
      }), /Config property "plugins" must be an array, received string/)

      assert.throws(() => defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: {}
      }), /Config property "plugins" must be an array, received object/)
    })

    it('should validate plugin objects in plugins array', () => {
      assert.throws(() => defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: [null]
      }), /Plugin at index 0 must be an object, received object/)

      // Valid plugin should not throw
      const validResult = defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: [{ name: 'valid-plugin' }]
      })
      assert.deepStrictEqual(validResult.plugins, [{ name: 'valid-plugin' }])

      assert.throws(() => defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: [{ name: 123 }]
      }), /Plugin at index 0 must have a valid "name" property \(non-empty string\)/)

      assert.throws(() => defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: [{ name: '' }]
      }), /Plugin at index 0 must have a valid "name" property \(non-empty string\)/)
    })

    it('should validate multiple plugins in array', () => {
      const result = defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: [
          { name: 'plugin1' },
          { name: 'plugin2' }
        ]
      })

      assert.strictEqual(result.plugins.length, 2)
      assert.strictEqual(result.plugins[0].name, 'plugin1')
      assert.strictEqual(result.plugins[1].name, 'plugin2')
    })

    it('should throw error for invalid plugin at specific index', () => {
      assert.throws(() => defineConfig({
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: [
          { name: 'valid' },
          { name: 456 },
          { name: 'another-valid' }
        ]
      }), /Plugin at index 1 must have a valid "name" property \(non-empty string\)/)
    })

    it('should handle edge cases with whitespace', () => {
      // Should trim and validate empty strings
      assert.throws(() => defineConfig({
        output: '  ',
        components: './components',
        pages: './pages'
      }), /Config property "output" cannot be empty/)
    })

    it('should preserve valid config with all state', () => {
      const fullConfig = {
        output: './dist',
        components: './components',
        pages: './pages',
        plugins: [
          { name: 'plugin1' },
          { name: 'plugin2' }
        ]
      }

      const result = defineConfig(fullConfig)
      assert.deepStrictEqual(result, fullConfig)
    })

    describe('testing and mocks validation', () => {
      it('should allow valid testing mode and mocks configuration', () => {
        const config = {
          output: './dist',
          components: './components',
          pages: './pages',
          mode: 'testing',
          testing: {
            mocks: {
              components: {
                'my-component': {
                  server: async () => ({ mocked: true })
                }
              },
              plugins: {
                'my-plugin': {
                  server: {
                    context: { foo: 'bar' }
                  },
                  client: {
                    context: { baz: 'qux' }
                  }
                }
              }
            }
          }
        }
        const result = defineConfig(config)
        assert.deepStrictEqual(result, config)
      })

      it('should throw error when testing is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: 'not-an-object'
        }), /Config property "testing" must be an object/)
      })

      it('should throw error when testing.mocks is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: 'not-an-object'
          }
        }), /Config property "testing.mocks" must be an object/)
      })

      it('should throw error for invalid key in testing.mocks', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              'invalid-key': {}
            }
          }
        }), /Invalid key "invalid-key" in testing.mocks/)
      })

      it('should throw error when testing.mocks.components is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              components: 'not-an-object'
            }
          }
        }), /Config property "testing.mocks.components" must be an object/)
      })

      it('should throw error when a component mock definition is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              components: {
                'my-component': 'not-an-object'
              }
            }
          }
        }), /Mock for component "my-component" must be an object/)
      })

      it('should throw error when component mock.server is defined but is not a function', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              components: {
                'my-component': {
                  server: 'not-a-function'
                }
              }
            }
          }
        }), /Mock server for component "my-component" must be a function/)
      })

      it('should throw error when testing.mocks.plugins is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              plugins: 'not-an-object'
            }
          }
        }), /Config property "testing.mocks.plugins" must be an object/)
      })

      it('should throw error when a plugin mock definition is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              plugins: {
                'my-plugin': 'not-an-object'
              }
            }
          }
        }), /Mock for plugin "my-plugin" must be an object/)
      })

      it('should throw error when plugin mock server is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              plugins: {
                'my-plugin': {
                  server: 'not-an-object'
                }
              }
            }
          }
        }), /Mock server for plugin "my-plugin" must be an object/)
      })

      it('should throw error when plugin mock server context is not an object', () => {
        assert.throws(() => defineConfig({
          output: './dist',
          components: './components',
          pages: './pages',
          testing: {
            mocks: {
              plugins: {
                'my-plugin': {
                  server: {
                    context: 'not-an-object'
                  }
                }
              }
            }
          }
        }), /Mock server context for plugin "my-plugin" must be an object/)
      })
    })
  })
})
