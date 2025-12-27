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
        templates: './templates',
        pages: './pages',
        plugins: []
      }

      const result = defineConfig(validConfig)
      assert.deepStrictEqual(result, validConfig)
    })

    it('should return valid config without plugins', () => {
      const validConfig = {
        output: './dist',
        templates: './templates',
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
        templates: './templates',
        pages: './pages'
      }), /Missing required config property: "output"/)

      assert.throws(() => defineConfig({
        output: './dist',
        pages: './pages'
      }), /Missing required config property: "templates"/)

      assert.throws(() => defineConfig({
        output: './dist',
        templates: './templates'
      }), /Missing required config property: "pages"/)
    })

    it('should throw error when required property is not a string', () => {
      assert.throws(() => defineConfig({
        output: 123,
        templates: './templates',
        pages: './pages'
      }), /Config property "output" must be a string, received number/)

      assert.throws(() => defineConfig({
        output: './dist',
        templates: {},
        pages: './pages'
      }), /Config property "templates" must be a string, received object/)

      assert.throws(() => defineConfig({
        output: './dist',
        templates: './templates',
        pages: []
      }), /Config property "pages" must be a string, received object/)
    })

    it('should throw error when required property is empty string', () => {
      assert.throws(() => defineConfig({
        output: '   ',
        templates: './templates',
        pages: './pages'
      }), /Config property "output" cannot be empty/)

      assert.throws(() => defineConfig({
        output: './dist',
        templates: '',
        pages: './pages'
      }), /Config property "templates" cannot be empty/)
    })

    it('should throw error when plugins is not an array', () => {
      assert.throws(() => defineConfig({
        output: './dist',
        templates: './templates',
        pages: './pages',
        plugins: 'not-an-array'
      }), /Config property "plugins" must be an array, received string/)

      assert.throws(() => defineConfig({
        output: './dist',
        templates: './templates',
        pages: './pages',
        plugins: {}
      }), /Config property "plugins" must be an array, received object/)
    })

    it('should validate plugin objects in plugins array', () => {
      assert.throws(() => defineConfig({
        output: './dist',
        templates: './templates',
        pages: './pages',
        plugins: [null]
      }), /Plugin at index 0 must be an object, received object/)

      // Valid plugin should not throw
      const validResult = defineConfig({
        output: './dist',
        templates: './templates',
        pages: './pages',
        plugins: [{ name: 'valid-plugin' }]
      })
      assert.deepStrictEqual(validResult.plugins, [{ name: 'valid-plugin' }])

      assert.throws(() => defineConfig({
        output: './dist',
        templates: './templates',
        pages: './pages',
        plugins: [{ name: 123 }]
      }), /Plugin at index 0 must have a valid "name" property \(non-empty string\)/)

      assert.throws(() => defineConfig({
        output: './dist',
        templates: './templates',
        pages: './pages',
        plugins: [{ name: '' }]
      }), /Plugin at index 0 must have a valid "name" property \(non-empty string\)/)
    })

    it('should validate multiple plugins in array', () => {
      const result = defineConfig({
        output: './dist',
        templates: './templates',
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
        templates: './templates',
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
        templates: './templates',
        pages: './pages'
      }), /Config property "output" cannot be empty/)
    })

    it('should preserve valid config with all properties', () => {
      const fullConfig = {
        output: './dist',
        templates: './templates',
        pages: './pages',
        plugins: [
          { name: 'plugin1' },
          { name: 'plugin2' }
        ]
      }

      const result = defineConfig(fullConfig)
      assert.deepStrictEqual(result, fullConfig)
    })
  })
})
