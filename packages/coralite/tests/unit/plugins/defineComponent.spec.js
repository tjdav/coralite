import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineComponent } from '../../../plugins/define-component.js'
import { parseHTML } from '../../../lib/parse.js'

/**
 * Test suite for defineComponent plugin
 *
 * This plugin handles component definition with:
 * - Token computation (sync and async)
 * - HTML parsing for string tokens
 * - Custom element processing
 * - Slot handling
 * - Script generation
 */

describe('defineComponent', () => {
  let mockContext
  let mockCreateComponent
  let mockDocument
  let mockElement
  let mockValues

  beforeEach(() => {
    // Mock createComponent function
    mockCreateComponent = async ({ id, values, element, document }) => {
      // Return a mock component with template children
      return {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: { class: `component-${id}` },
            children: [
              {
                type: 'text',
                data: `Component: ${id}`
              }
            ]
          }
        ]
      }
    }

    // Mock document
    mockDocument = {
      path: {
        pathname: '/test/path.html',
        dirname: '/test',
        filename: 'path.html'
      }
    }

    // Mock element with slots
    mockElement = {
      type: 'tag',
      name: 'test-component',
      attribs: {},
      children: [],
      slots: []
    }

    // Mock values
    mockValues = {
      title: 'Test Title',
      count: 5
    }

    // Mock context
    mockContext = {
      createComponent: mockCreateComponent,
      excludeByAttribute: []
    }
  })

  describe('Basic Functionality', () => {
    it('should return empty object when no options provided', async () => {
      const result = await defineComponent.method.call(mockContext, {}, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      // The function returns the original values when no tokens are provided
      assert.deepStrictEqual(result, mockValues)
    })

    it('should preserve existing values', async () => {
      const options = {
        tokens: {
          newToken: 'new value'
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.title, 'Test Title')
      assert.strictEqual(result.count, 5)
      assert.strictEqual(result.newToken, 'new value')
    })

    it('should handle empty tokens object', async () => {
      const options = { tokens: {} }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.deepStrictEqual(result, mockValues)
    })

    it('should handle null tokens', async () => {
      const options = { tokens: null }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.deepStrictEqual(result, mockValues)
    })
  })

  describe('Token Computation - Synchronous', () => {
    it('should handle string tokens', async () => {
      const options = {
        tokens: {
          greeting: 'Hello World',
          number: '42',
          empty: ''
        }
      }

      const mockParseHTML = (html) => {
        if (html === '') {
          return {
            root: { children: [] },
            customElements: [],
            tempElements: []
          }
        }
        return {
          root: {
            children: [{
              type: 'text',
              data: html
            }]
          },
          customElements: [],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.greeting, 'Hello World')
      assert.strictEqual(result.number, '42')
      assert.strictEqual(result.empty, '')
    })

    it('should handle function tokens that return strings', async () => {
      const options = {
        tokens: {
          uppercase: (values) => values.title.toUpperCase(),
          doubled: (values) => values.count * 2,
          concatenated: (values) => `${values.title} - ${values.count}`
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.uppercase, 'TEST TITLE')
      assert.strictEqual(result.doubled, 10)
      assert.strictEqual(result.concatenated, 'Test Title - 5')
    })

    it('should handle function tokens that return numbers', async () => {
      const options = {
        tokens: {
          add: (values) => values.count + 10,
          multiply: (values) => values.count * 3
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.add, 15)
      assert.strictEqual(result.multiply, 15)
    })

    it('should handle function tokens that return empty string', async () => {
      const options = {
        tokens: {
          empty: () => ''
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.empty, '')
    })

    it('should handle function tokens that return null/undefined', async () => {
      const options = {
        tokens: {
          nullValue: () => null,
          undefinedValue: () => undefined,
          falsyValue: () => 0
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.nullValue, 'null')
      assert.strictEqual(result.undefinedValue, 'undefined')
      assert.strictEqual(result.falsyValue, '0')
    })

    it('should handle function tokens with no parameters', async () => {
      const options = {
        tokens: {
          staticValue: () => 'static'
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.staticValue, 'static')
    })
  })

  describe('Token Computation - Asynchronous', () => {
    it('should handle async function tokens that resolve to strings', async () => {
      const options = {
        tokens: {
          asyncString: async () => {
            return new Promise((resolve) => {
              setTimeout(() => resolve('async result'), 10)
            })
          }
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.asyncString, 'async result')
    })

    it('should handle async function tokens that resolve to numbers', async () => {
      const options = {
        tokens: {
          asyncNumber: async () => {
            return new Promise((resolve) => {
              setTimeout(() => resolve(123), 10)
            })
          }
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.asyncNumber, 123)
    })

    it('should handle async function tokens that resolve to objects', async () => {
      const options = {
        tokens: {
          asyncObject: async () => {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve({ key: 'value' })
              }, 10)
            })
          }
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.deepStrictEqual(result.asyncObject, { key: 'value' })
    })

    it('should handle mixed sync and async tokens', async () => {
      const options = {
        tokens: {
          sync: 'sync value',
          async: async () => {
            return new Promise((resolve) => setTimeout(() => resolve('async value'), 10))
          },
          func: (values) => values.title
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.sync, 'sync value')
      assert.strictEqual(result.func, 'Test Title')
    })

    it('should handle multiple async tokens', async () => {
      const options = {
        tokens: {
          async1: async () => {
            return new Promise((resolve) => setTimeout(() => resolve('result1'), 5))
          },
          async2: async () => {
            return new Promise((resolve) => setTimeout(() => resolve('result2'), 10))
          }
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.async1, 'result1')
      assert.strictEqual(result.async2, 'result2')
    })
  })

  describe('HTML Parsing for String Tokens', () => {
    it('should parse simple HTML string tokens', async () => {
      const options = {
        tokens: {
          html: '<p>Simple paragraph</p>'
        }
      }

      // Mock parseHTML to return actual parsed structure
      const mockParseHTML = (html) => {
        return {
          root: {
            children: [{
              type: 'tag',
              name: 'p',
              attribs: {},
              children: [{
                type: 'text',
                data: 'Simple paragraph'
              }]
            }]
          },
          customElements: [],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.html))
      assert.strictEqual(result.html.length, 1)
      assert.strictEqual(result.html[0].name, 'p')
      assert.strictEqual(result.html[0].children[0].data, 'Simple paragraph')
    })

    it('should parse HTML with multiple elements', async () => {
      const options = {
        tokens: {
          content: '<div>First</div><span>Second</span>'
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: {
            children: [
              {
                type: 'tag',
                name: 'div',
                attribs: {},
                children: [{
                  type: 'text',
                  data: 'First'
                }]
              },
              {
                type: 'tag',
                name: 'span',
                attribs: {},
                children: [{
                  type: 'text',
                  data: 'Second'
                }]
              }
            ]
          },
          customElements: [],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.content))
      assert.strictEqual(result.content.length, 2)
      assert.strictEqual(result.content[0].name, 'div')
      assert.strictEqual(result.content[1].name, 'span')
    })

    it('should parse HTML with only text node', async () => {
      const options = {
        tokens: {
          textOnly: 'Just text content'
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: {
            children: [{
              type: 'text',
              data: 'Just text content'
            }]
          },
          customElements: [],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.textOnly, 'Just text content')
    })

    it('should handle empty HTML string', async () => {
      const options = {
        tokens: {
          emptyHtml: ''
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: { children: [] },
          customElements: [],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.emptyHtml, '')
    })

    it('should process custom elements in HTML tokens', async () => {
      const options = {
        tokens: {
          withComponent: '<my-component></my-component>'
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: {
            children: [{
              type: 'tag',
              name: 'my-component',
              attribs: {},
              children: [],
              slots: []
            }]
          },
          customElements: [{
            type: 'tag',
            name: 'my-component',
            attribs: {},
            children: [],
            slots: []
          }],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.withComponent))
      assert.strictEqual(result.withComponent.length, 1)
    })
  })

  describe('Async Token HTML Processing', () => {
    it('should parse HTML from async token results', async () => {
      const options = {
        tokens: {
          asyncHtml: async () => {
            return new Promise((resolve) => {
              setTimeout(() => resolve('<strong>Async HTML</strong>'), 10)
            })
          }
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: {
            children: [{
              type: 'tag',
              name: 'strong',
              attribs: {},
              children: [{
                type: 'text',
                data: 'Async HTML'
              }]
            }]
          },
          customElements: [],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.asyncHtml))
      assert.strictEqual(result.asyncHtml[0].name, 'strong')
    })

    it('should process custom elements in async HTML tokens', async () => {
      const options = {
        tokens: {
          asyncComponent: async () => {
            return new Promise((resolve) => {
              setTimeout(() => resolve('<async-component>Content</async-component>'), 10)
            })
          }
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: {
            children: [{
              type: 'tag',
              name: 'async-component',
              attribs: {},
              children: [{
                type: 'text',
                data: 'Content'
              }],
              slots: []
            }]
          },
          customElements: [{
            type: 'tag',
            name: 'async-component',
            attribs: {},
            children: [{
              type: 'text',
              data: 'Content'
            }],
            slots: []
          }],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.asyncComponent))
      assert.strictEqual(result.asyncComponent.length, 1)
    })
  })

  describe('Slot Handling', () => {
    it('should handle slots with no computed slots', async () => {
      const options = {
        slots: {}
      }

      mockElement.slots = [
        {
          name: 'default',
          node: {
            type: 'text',
            data: 'Default content'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      // Should not modify slots when no computed slots provided
      assert.strictEqual(mockElement.slots.length, 1)
      assert.strictEqual(mockElement.slots[0].name, 'default')
    })

    it('should compute slot with string result', async () => {
      const options = {
        slots: {
          header: (slotContent, values) => {
            return `Header: ${values.title}`
          }
        }
      }

      mockElement.slots = [
        {
          name: 'header',
          node: {
            type: 'text',
            data: 'Original'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 1)
      assert.strictEqual(mockElement.slots[0].name, 'header')
      assert.strictEqual(mockElement.slots[0].node.type, 'text')
      assert.strictEqual(mockElement.slots[0].node.data, 'Header: Test Title')
    })

    it('should compute slot with array result', async () => {
      const options = {
        slots: {
          content: (slotContent, values) => {
            return [
              {
                type: 'text',
                data: 'Line 1'
              },
              {
                type: 'text',
                data: 'Line 2'
              }
            ]
          }
        }
      }

      mockElement.slots = [
        {
          name: 'content',
          node: {
            type: 'text',
            data: 'Original'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 2)
      assert.strictEqual(mockElement.slots[0].node.data, 'Line 1')
      assert.strictEqual(mockElement.slots[1].node.data, 'Line 2')
    })

    it('should handle slot with empty content array', async () => {
      const options = {
        slots: {
          empty: (slotContent, values) => {
            return []
          }
        }
      }

      mockElement.slots = [
        {
          name: 'empty',
          node: {
            type: 'text',
            data: 'Original'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 0)
    })

    it('should filter out empty text nodes in slot content', async () => {
      const options = {
        slots: {
          filtered: (slotContent, values) => {
            return slotContent
          }
        }
      }

      mockElement.slots = [
        {
          name: 'filtered',
          node: {
            type: 'text',
            data: '   '
          }
        }, // whitespace only
        {
          name: 'filtered',
          node: {
            type: 'text',
            data: 'Valid'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      // Should only process the non-empty slot
      assert.strictEqual(mockElement.slots.length, 1)
      assert.strictEqual(mockElement.slots[0].node.data, 'Valid')
    })

    it('should handle multiple slots with different names', async () => {
      const options = {
        slots: {
          header: (content, values) => `Header: ${values.title}`,
          footer: (content, values) => `Footer: ${values.count}`
        }
      }

      mockElement.slots = [
        {
          name: 'header',
          node: {
            type: 'text',
            data: 'Original Header'
          }
        },
        {
          name: 'footer',
          node: {
            type: 'text',
            data: 'Original Footer'
          }
        },
        {
          name: 'other',
          node: {
            type: 'text',
            data: 'Other'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 3)

      const headerSlot = mockElement.slots.find(s => s.name === 'header')
      const footerSlot = mockElement.slots.find(s => s.name === 'footer')
      const otherSlot = mockElement.slots.find(s => s.name === 'other')

      assert.strictEqual(headerSlot.node.data, 'Header: Test Title')
      assert.strictEqual(footerSlot.node.data, 'Footer: 5')
      assert.strictEqual(otherSlot.node.data, 'Other') // unchanged
    })

    it('should throw error for invalid slot node type', async () => {
      const options = {
        slots: {
          invalid: () => {
            return [{ invalid: 'object' }]
          }
        }
      }

      mockElement.slots = [
        {
          name: 'invalid',
          node: {
            type: 'text',
            data: 'Original'
          }
        }
      ]

      await assert.rejects(
        async () => {
          await defineComponent.method.call(mockContext, options, {
            values: mockValues,
            element: mockElement,
            document: mockDocument
          })
        },
        /Unexpected slot value/
      )
    })

    it('should handle slot function returning null/undefined', async () => {
      const options = {
        slots: {
          nullSlot: () => null,
          undefinedSlot: () => undefined
        }
      }

      mockElement.slots = [
        {
          name: 'nullSlot',
          node: {
            type: 'text',
            data: 'Original'
          }
        },
        {
          name: 'undefinedSlot',
          node: {
            type: 'text',
            data: 'Original'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      // Should keep original slots when function returns null/undefined
      assert.strictEqual(mockElement.slots.length, 2)
      assert.strictEqual(mockElement.slots[0].node.data, 'Original')
      assert.strictEqual(mockElement.slots[1].node.data, 'Original')
    })
  })

  describe('Script Handling', () => {
    it('should handle no script provided', async () => {
      const options = {}

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.__script__, undefined)
    })

    it('should generate __script__ for function script', async () => {
      const options = {
        script: function (values) {
          console.log(values.title)
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(result.__script__)
      assert.strictEqual(typeof result.__script__.fn, 'function')
      assert.deepStrictEqual(result.__script__.values, { title: 'Test Title' })

      // Verify the function content
      const fnString = result.__script__.fn.toString()
      assert.ok(fnString.includes('console.log(values.title)'))
    })

    it('should include only values used in script', async () => {
      const options = {
        script: function (values) {
          return values.title.toUpperCase()
        }
      }

      const extraValues = {
        ...mockValues,
        unused: 'should not appear'
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: extraValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(result.__script__)
      assert.deepStrictEqual(result.__script__.values, { title: 'Test Title' })
      assert.ok(!('count' in result.__script__.values))
      assert.ok(!('unused' in result.__script__.values))
    })

    it('should handle script with no values used', async () => {
      const options = {
        script: function () {
          return 'static script'
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(result.__script__)
      assert.deepStrictEqual(result.__script__.values, {})
    })

    it('should handle script starting with "script" keyword', async () => {
      const options = {
        script: function script (values) {
          return values.title
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(result.__script__)
      assert.strictEqual(typeof result.__script__.fn, 'function')
      assert.deepStrictEqual(result.__script__.values, { title: 'Test Title' })

      // Verify the function name is preserved
      const fnString = result.__script__.fn.toString()
      assert.ok(fnString.includes('function script (values)'))
    })

    it('should remove __script__ when script is undefined', async () => {
      const options = {
        script: function (values) {
          return values.title
        }
      }

      // First call with script
      const result1 = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(result1.__script__)

      // Second call without script
      const options2 = {
        script: undefined
      }

      const result2 = await defineComponent.method.call(mockContext, options2, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result2.__script__, undefined)
    })

    it('should handle complex script function', async () => {
      const options = {
        script: function (values) {
          const title = values.title
          const count = values.count
          return `${title}: ${count * 2}`
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(result.__script__)
      assert.strictEqual(typeof result.__script__.fn, 'function')
      assert.deepStrictEqual(result.__script__.values, {
        title: 'Test Title',
        count: 5
      })

      // Verify the function content
      const fnString = result.__script__.fn.toString()
      assert.ok(fnString.includes('const title = values.title'))
      assert.ok(fnString.includes('const count = values.count'))
      assert.ok(fnString.includes('return `${title}: ${count * 2}`'))
    })
  })

  describe('Error Handling', () => {
    it('should handle tokens object with prototype properties', async () => {
      const options = {
        tokens: {
          own: 'own value',
          __proto__: { polluted: 'should not appear' }
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.own, 'own value')
      // __proto__ is filtered out by hasOwnProperty check, so it's not in the result
      assert.ok(!('polluted' in result))
      // result.__proto__ returns the prototype object, not null
      assert.ok(typeof result.__proto__ === 'object')
    })

    it('should handle tokens with hasOwnProperty', async () => {
      const options = {
        tokens: {
          own: 'own value',
          hasOwnProperty: () => 'should work'
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.own, 'own value')
      assert.strictEqual(result.hasOwnProperty, 'should work')
    })

    it('should handle async token rejection', async () => {
      const options = {
        tokens: {
          failing: async () => {
            throw new Error('Async error')
          }
        }
      }

      await assert.rejects(
        async () => {
          await defineComponent.method.call(mockContext, options, {
            values: mockValues,
            element: mockElement,
            document: mockDocument
          })
        },
        /Async error/
      )
    })

    it('should handle sync function throwing error', async () => {
      const options = {
        tokens: {
          throwing: () => {
            throw new Error('Sync error')
          }
        }
      }

      await assert.rejects(
        async () => {
          await defineComponent.method.call(mockContext, options, {
            values: mockValues,
            element: mockElement,
            document: mockDocument
          })
        },
        /Sync error/
      )
    })

    it('should handle createComponent failure', async () => {
      const options = {
        tokens: {
          withComponent: '<my-component></my-component>'
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: {
            children: [{
              type: 'tag',
              name: 'my-component',
              attribs: {},
              children: [],
              slots: []
            }]
          },
          customElements: [{
            type: 'tag',
            name: 'my-component',
            attribs: {},
            children: [],
            slots: []
          }],
          tempElements: []
        }
      }

      const failingContext = {
        ...mockContext,
        parseHTML: mockParseHTML,
        createComponent: async () => {
          throw new Error('Component creation failed')
        }
      }

      await assert.rejects(
        async () => {
          await defineComponent.method.call(failingContext, options, {
            values: mockValues,
            element: mockElement,
            document: mockDocument
          })
        },
        /Component creation failed/
      )
    })
  })

  describe('Integration with Real parseHTML', () => {
    it('should work with actual parseHTML function for simple tokens', async () => {
      const options = {
        tokens: {
          simple: '<p>Real parsing</p>',
          mixed: '<div><span>Text</span></div>'
        }
      }

      const context = {
        ...mockContext,
        parseHTML: parseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.simple))
      assert.ok(Array.isArray(result.mixed))
      assert.strictEqual(result.simple[0].name, 'p')
      assert.strictEqual(result.mixed[0].name, 'div')
    })

    it('should handle custom elements with real parseHTML', async () => {
      const options = {
        tokens: {
          component: '<my-button>Click me</my-button>'
        }
      }

      const context = {
        ...mockContext,
        parseHTML: parseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.component))
      assert.ok(Array.isArray(result.component[0].children))
      assert.strictEqual(result.component[0].children[0].data, 'Component: my-button')
    })

    it('should handle empty HTML with real parseHTML', async () => {
      const options = {
        tokens: {
          empty: ''
        }
      }

      const context = {
        ...mockContext,
        parseHTML: parseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.empty, '')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large token values', async () => {
      const largeString = 'x'.repeat(10000)
      const options = {
        tokens: {
          large: largeString
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.large, largeString)
    })

    it('should handle Unicode characters in tokens', async () => {
      const options = {
        tokens: {
          unicode: 'Hello 世界 🌍',
          emoji: '😀😁😂'
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.unicode, 'Hello 世界 🌍')
      assert.strictEqual(result.emoji, '😀😁😂')
    })

    it('should handle special HTML characters in string tokens', async () => {
      const options = {
        tokens: {
          special: '<script>alert("xss")</script>',
          ampersand: 'A & B',
          quotes: '"quoted"'
        }
      }

      const mockParseHTML = (html) => {
        return {
          root: { children: [] },
          customElements: [],
          tempElements: []
        }
      }

      const context = {
        ...mockContext,
        parseHTML: mockParseHTML
      }

      const result = await defineComponent.method.call(context, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      // Should be parsed by HTML parser, not treated as plain text
      assert.ok(result.special !== '<script>alert("xss")</script>')
    })

    it('should handle circular references in values', async () => {
      const circularValues = { title: 'Test' }
      circularValues.self = circularValues

      const options = {
        tokens: {
          ref: (values) => values.title
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: circularValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(result.ref, 'Test')
    })

    it('should handle very deeply nested async operations', async () => {
      const options = {
        tokens: {
          level1: async () => {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve({
                  level2: async () => {
                    return new Promise((innerResolve) => {
                      setTimeout(() => innerResolve('deep'), 5)
                    })
                  }
                })
              }, 5)
            })
          }
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      // Should handle the async object
      assert.ok(typeof result.level1 === 'object')
    })

    it('should handle slots with complex node types', async () => {
      const options = {
        slots: {
          complex: (content, values) => {
            return [
              {
                type: 'tag',
                name: 'div',
                attribs: {},
                children: []
              },
              {
                type: 'text',
                data: 'text'
              },
              {
                type: 'comment',
                data: 'comment'
              }
            ]
          }
        }
      }

      mockElement.slots = [
        {
          name: 'complex',
          node: {
            type: 'text',
            data: 'Original'
          }
        }
      ]

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 3)
      assert.strictEqual(mockElement.slots[0].node.type, 'tag')
      assert.strictEqual(mockElement.slots[1].node.type, 'text')
      assert.strictEqual(mockElement.slots[2].node.type, 'comment')
    })
  })

  describe('Performance', () => {
    it('should handle many tokens efficiently', async () => {
      const manyTokens = {}
      for (let i = 0; i < 100; i++) {
        manyTokens[`token${i}`] = `value${i}`
      }

      const options = { tokens: manyTokens }

      const start = Date.now()
      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })
      const end = Date.now()

      assert.strictEqual(result.token0, 'value0')
      assert.strictEqual(result.token99, 'value99')
      assert.ok(end - start < 100, `Should complete in < 100ms, took ${end - start}ms`)
    })

    it('should handle many async tokens efficiently', async () => {
      const asyncTokens = {}
      for (let i = 0; i < 10; i++) {
        asyncTokens[`async${i}`] = async () => {
          return new Promise((resolve) => setTimeout(() => resolve(`async${i}`), 1))
        }
      }

      const options = { tokens: asyncTokens }

      const start = performance.now()
      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })
      const end = performance.now()

      assert.strictEqual(result.async0, 'async0')
      assert.strictEqual(result.async9, 'async9')
      assert.ok(end - start < 200, `Should complete in < 200ms, took ${end - start}ms`)
    })
  })
})
