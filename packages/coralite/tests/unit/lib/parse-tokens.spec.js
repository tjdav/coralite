import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { parseModule } from '../../../lib/parse.js'

/**
 * Test suite for the improved getTokensFromString function
 *
 * This tests the new character-by-character parser that replaces the regex-based approach
 */

describe('Token Extraction (getTokensFromString)', () => {
  // Helper function to extract tokens from a template string for testing
  function extractTokensFromTemplate (templateString) {
    const result = parseModule(templateString, { ignoreByAttribute: [] })
    if (!result.isTemplate) {
      throw new Error('Invalid template')
    }

    // Extract all tokens from the parsed result
    const tokens = []

    // Get tokens from text nodes
    if (result.values && result.values.textNodes) {
      result.values.textNodes.forEach(node => {
        tokens.push(...node.tokens)
      })
    }

    // Get tokens from attributes
    if (result.values && result.values.attributes) {
      result.values.attributes.forEach(attr => {
        tokens.push(...attr.tokens)
      })
    }

    return tokens
  }

  describe('Basic Token Extraction', () => {
    it('should extract a single token', () => {
      const template = `<template id="my-component">{{ name }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, 'name')
      assert.strictEqual(tokens[0].content, '{{ name }}')
    })

    it('should extract multiple tokens', () => {
      const template = `<template id="my-comp">{{ firstName }} {{ lastName }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'firstName')
      assert.strictEqual(tokens[1].name, 'lastName')
    })

    it('should handle tokens with spaces', () => {
      const template = `<template id="my-comp">{{ user name }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, 'user name')
    })

    it('should handle tokens with dots', () => {
      const template = `<template id="my-comp">{{ user.name }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, 'user.name')
    })

    it('should handle tokens with brackets', () => {
      const template = `<template id="my-comp">{{ items[0] }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, 'items[0]')
    })

    it('should handle tokens with hyphens and underscores', () => {
      const template = `<template id="my-comp">{{ user-name }} {{ user_name }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'user-name')
      assert.strictEqual(tokens[1].name, 'user_name')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty tokens', () => {
      const template = `<template id="my-comp">{{ }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, '')
      assert.strictEqual(tokens[0].content, '{{ }}')
    })

    it('should handle tokens with only whitespace', () => {
      const template = `<template id="my-comp">{{   }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, '')
    })

    it('should handle malformed tokens (unclosed)', () => {
      const template = `<template id="my-comp">{{ unclosed</template>`
      const tokens = extractTokensFromTemplate(template)

      // Should not extract incomplete tokens
      assert.strictEqual(tokens.length, 0)
    })

    it('should handle tokens with extra braces', () => {
      const template = `<template id="my-comp">{{ {value} }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, '{value}')
    })

    it('should handle nested tokens', () => {
      const template = `<template id="my-comp">{{ {{nested}} }}</template>`
      const tokens = extractTokensFromTemplate(template)

      // Should extract both the outer and inner tokens
      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, '{{nested}}')
      assert.strictEqual(tokens[1].name, 'nested')
    })

    it('should handle complex nested structure', () => {
      const template = `<template id="my-comp">{{ outer {{ inner }} end }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'outer {{ inner }} end')
      assert.strictEqual(tokens[1].name, 'inner')
    })
  })

  describe('Multiple Tokens in Complex Strings', () => {
    it('should handle tokens mixed with text', () => {
      const template = `<template id="my-comp">Hello {{ name }}, you are {{ age }} years old.</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'name')
      assert.strictEqual(tokens[1].name, 'age')
    })

    it('should handle consecutive tokens', () => {
      const template = `<template id="my-comp">{{ first }}{{ second }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'first')
      assert.strictEqual(tokens[1].name, 'second')
    })

    it('should handle tokens with newlines', () => {
      const template = `<template id="my-comp">{{ first
}} {{ second }}</template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'first')
      assert.strictEqual(tokens[1].name, 'second')
    })
  })

  describe('Attribute Tokens', () => {
    it('should extract tokens from attributes', () => {
      const template = `<template id="my-comp"><div class="{{ className }}">Content</div></template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, 'className')
      assert.strictEqual(tokens[0].content, '{{ className }}')
    })

    it('should extract multiple tokens from one attribute', () => {
      const template = `<template id="my-comp"><div class="{{ prefix }}-{{ suffix }}">Content</div></template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'prefix')
      assert.strictEqual(tokens[1].name, 'suffix')
    })

    it('should extract tokens from multiple attributes', () => {
      const template = `<template id="my-comp"><div class="{{ className }}" id="{{ id }}">Content</div></template>`
      const tokens = extractTokensFromTemplate(template)

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'className')
      assert.strictEqual(tokens[1].name, 'id')
    })
  })

  describe('Performance', () => {
    it('should handle long strings efficiently', () => {
      const longText = 'x'.repeat(1000)
      const template = `<template id="my-comp">${longText} {{ token1 }} ${longText} {{ token2 }} ${longText}</template>`

      const start = Date.now()
      const tokens = extractTokensFromTemplate(template)
      const end = Date.now()

      assert.strictEqual(tokens.length, 2)
      assert.strictEqual(tokens[0].name, 'token1')
      assert.strictEqual(tokens[1].name, 'token2')
      assert.ok(end - start < 100, `Should complete in < 100ms, took ${end - start}ms`)
    })

    it('should handle many tokens efficiently', () => {
      let template = '<template id="my-comp">'
      const tokenCount = 50
      for (let i = 0; i < tokenCount; i++) {
        template += `{{ token${i} }} `
      }
      template += '</template>'

      const start = Date.now()
      const tokens = extractTokensFromTemplate(template)
      const end = Date.now()

      assert.strictEqual(tokens.length, tokenCount)
      assert.ok(end - start < 100, `Should complete in < 100ms, took ${end - start}ms`)
    })

    it('should handle deeply nested tokens', () => {
      let template = '<template id="my-comp">{{ '
      const depth = 10
      for (let i = 0; i < depth; i++) {
        template += '{{ '
      }
      for (let i = 0; i < depth; i++) {
        template += ' }}'
      }
      template += ' }}</template>'

      const start = Date.now()
      const tokens = extractTokensFromTemplate(template)
      const end = Date.now()

      // Should extract all nested tokens
      assert.ok(tokens.length >= 1)
      assert.ok(end - start < 100, `Should complete in < 100ms, took ${end - start}ms`)
    })
  })

  describe('Backward Compatibility', () => {
    it('should handle the same cases as the old regex implementation', () => {
      const testCases = [
        {
          input: '{{ name }}',
          expected: 1
        },
        {
          input: '{{ name }} and {{ age }}',
          expected: 2
        },
        {
          input: 'No tokens here',
          expected: 0
        },
        {
          input: '{{}}',
          expected: 1
        },
        {
          input: '{{ user.name }}',
          expected: 1
        },
        {
          input: '{{ items[0] }}',
          expected: 1
        },
        {
          input: '{{ a }}{{ b }}{{ c }}',
          expected: 3
        }
      ]

      testCases.forEach(({ input, expected }) => {
        const template = `<template id="my-comp">${input}</template>`
        const tokens = extractTokensFromTemplate(template)
        assert.strictEqual(tokens.length, expected, `Failed for: ${input}`)
      })
    })

    it('should not break with the old warning threshold', () => {
      // The old implementation warned for strings > 100 chars
      // The new one should handle them without warnings
      const longToken = 'x'.repeat(150)
      const template = `<template id="my-comp">{{ ${longToken} }}</template>`

      // Should not throw or warn
      const tokens = extractTokensFromTemplate(template)
      assert.strictEqual(tokens.length, 1)
      assert.strictEqual(tokens[0].name, longToken)
    })
  })
})

// Additional test to verify the function directly if we can expose it
describe('Direct getTokensFromString tests', () => {
  // We'll need to test this indirectly through parseModule for now
  // In a real scenario, we might export the function for direct testing

  it('should be able to handle all edge cases without regex limitations', () => {
    // This test validates the core improvement: no arbitrary length limits
    const veryLongToken = 'a'.repeat(1000)
    const template = `<template id="my-comp">{{ ${veryLongToken} }}</template>`

    const result = parseModule(template, { ignoreByAttribute: [] })
    if (!result.isTemplate) {
      throw new Error('Invalid template')
    }
    const tokens = result.values.textNodes[0]?.tokens || []

    assert.strictEqual(tokens.length, 1)
    assert.strictEqual(tokens[0].name, veryLongToken)
  })
})
