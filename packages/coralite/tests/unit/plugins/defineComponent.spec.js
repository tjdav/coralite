import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { defineComponent } from '../../../plugins/define-component.js'

/**
 * Test suite for defineComponent plugin
 */

describe('defineComponent', () => {
  let mockContext
  let mockCreateComponent
  let createComponentCalls
  let mockDocument
  let mockElement
  let mockValues

  beforeEach(() => {
    createComponentCalls = []

    // Mock createComponent function with call tracking
    mockCreateComponent = async ({ id, values, element, document, contextId }) => {
      createComponentCalls.push({
        id,
        values,
        element,
        document,
        contextId
      })

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
      const result = await defineComponent.method.call(mockContext, options, {
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
          asyncString: async () => new Promise(r => setTimeout(() => r('async result'), 1))
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
          asyncNumber: async () => new Promise(r => setTimeout(() => r(123), 1))
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
          asyncObject: async () => new Promise(r => setTimeout(() => r({ key: 'value' }), 1))
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
          async: async () => new Promise(r => setTimeout(() => r('async value'), 1)),
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
          async1: async () => new Promise(r => setTimeout(() => r('result1'), 1)),
          async2: async () => new Promise(r => setTimeout(() => r('result2'), 1))
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
    it('should parse HTML string tokens into AST', async () => {
      const options = {
        tokens: {
          html: '<p>Paragraph</p>'
        }
      }
      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(Array.isArray(result.html), 'Result should be an array (AST)')
      assert.strictEqual(result.html.length, 1)
      assert.strictEqual(result.html[0].name, 'p')
      assert.strictEqual(result.html[0].children[0].data, 'Paragraph')
    })

    it('should parse multiple elements', async () => {
      const options = {
        tokens: {
          content: '<div>A</div><span>B</span>'
        }
      }
      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

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
      const result = await defineComponent.method.call(mockContext, options, {
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
      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })
      assert.strictEqual(result.emptyHtml, '')
    })
  })

  describe('Custom Element Processing', () => {
    it('should verify createComponent arguments including attributes', async () => {
      const options = {
        tokens: {
          comp: '<my-elem class="btn" type="submit"></my-elem>'
        }
      }

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(createComponentCalls.length, 1)
      const call = createComponentCalls[0]
      assert.strictEqual(call.id, 'my-elem')
      assert.deepStrictEqual(call.element.attribs, {
        class: 'btn',
        type: 'submit'
      })
    })

    it('should verify context ID generation', async () => {
      const options = {
        tokens: {
          comp: '<my-elem></my-elem><other-elem></other-elem>'
        }
      }

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(createComponentCalls.length, 2)

      const call1 = createComponentCalls.find(c => c.id === 'my-elem')
      const call2 = createComponentCalls.find(c => c.id === 'other-elem')

      assert.strictEqual(call1.contextId, '/test/path.htmlmy-elem-0')
      assert.strictEqual(call2.contextId, '/test/path.htmlother-elem-1')
    })

    it('should pass children as content/slots to createComponent', async () => {
      const options = {
        tokens: {
          comp: '<wrapper-elem><span>Child Content</span></wrapper-elem>'
        }
      }

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(createComponentCalls.length, 1)
      const call = createComponentCalls[0]
      assert.strictEqual(call.element.children.length, 1)
      assert.strictEqual(call.element.children[0].name, 'span')
      assert.strictEqual(call.element.children[0].children[0].data, 'Child Content')
    })

    it('should handle nested custom elements correctly (custom inside custom)', async () => {
      const options = {
        tokens: {
          comp: '<outer-elem><inner-elem></inner-elem></outer-elem>'
        }
      }

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(createComponentCalls.length, 2)
      const outer = createComponentCalls.find(c => c.id === 'outer-elem')
      const inner = createComponentCalls.find(c => c.id === 'inner-elem')

      assert.ok(outer, 'Outer element should be processed')
      assert.ok(inner, 'Inner element should be processed')
    })

    it('should handle nested custom elements inside standard tags', async () => {
      const options = {
        tokens: {
          comp: '<div><nested-elem></nested-elem></div>'
        }
      }

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(createComponentCalls.length, 1)
      const call = createComponentCalls[0]
      assert.strictEqual(call.id, 'nested-elem')
    })

    it('should verify DOM replacement', async () => {
      const options = {
        tokens: {
          comp: '<replace-me></replace-me>'
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      const tokenAST = result.comp
      assert.ok(Array.isArray(tokenAST))
      assert.strictEqual(tokenAST.length, 1)
      assert.strictEqual(tokenAST[0].name, 'div')
      assert.strictEqual(tokenAST[0].attribs.class, 'component-replace-me')
      assert.strictEqual(tokenAST[0].children[0].data, 'Component: replace-me')
    })

    it('should propagate errors from createComponent', async () => {
      const options = {
        tokens: {
          comp: '<fail-elem></fail-elem>'
        }
      }

      mockContext.createComponent = async () => {
        throw new Error('Creation Failed')
      }

      await assert.rejects(async () => {
        await defineComponent.method.call(mockContext, options, {
          values: mockValues,
          element: mockElement,
          document: mockDocument
        })
      }, /Creation Failed/)
    })
  })

  describe('Slot Handling', () => {
    it('should handle slots with no computed slots', async () => {
      const options = { slots: {} }

      mockElement.slots = [{
        name: 'default',
        node: {
          type: 'text',
          data: 'def'
        }
      }]

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 1)
      assert.strictEqual(mockElement.slots[0].name, 'default')
    })

    it('should compute slot with string result', async () => {
      const options = {
        slots: {
          header: (content, values) => `Header: ${values.title}`
        }
      }

      mockElement.slots = [{
        name: 'header',
        node: {
          type: 'text',
          data: 'orig'
        }
      }]

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      const headerSlot = mockElement.slots.find(s => s.name === 'header')
      assert.strictEqual(headerSlot.node.data, 'Header: Test Title')
    })

    it('should compute slot with array result', async () => {
      const options = {
        slots: {
          content: () => [
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

      mockElement.slots = [{
        name: 'content',
        node: {
          type: 'text',
          data: 'orig'
        }
      }]

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 2)
      assert.strictEqual(mockElement.slots[0].node.data, 'Line 1')
      assert.strictEqual(mockElement.slots[1].node.data, 'Line 2')
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

      await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.strictEqual(mockElement.slots.length, 3)
      assert.strictEqual(mockElement.slots.find(s => s.name === 'header').node.data, 'Header: Test Title')
      assert.strictEqual(mockElement.slots.find(s => s.name === 'footer').node.data, 'Footer: 5')
      assert.strictEqual(mockElement.slots.find(s => s.name === 'other').node.data, 'Other')
    })

    it('should throw error for invalid slot node type', async () => {
      const options = {
        slots: {
          invalid: () => [{ invalid: 'object' }]
        }
      }

      mockElement.slots = [{
        name: 'invalid',
        node: {
          type: 'text',
          data: 'Original'
        }
      }]

      await assert.rejects(async () => {
        await defineComponent.method.call(mockContext, options, {
          values: mockValues,
          element: mockElement,
          document: mockDocument
        })
      }, /Unexpected slot value/)
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

    it('should generate __script__', async () => {
      const options = {
        client: {
          script: function (values) {
            return values.title
          }
        }
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })

      assert.ok(result.__script__)
      assert.deepStrictEqual(result.__script__.values, { title: 'Test Title' })
    })

    it('should include only values used in script', async () => {
      const options = {
        client: {
          script: function (values) {
            return values.title.toUpperCase()
          }
        }
      }
      const extraValues = {
        ...mockValues,
        unused: 'skip'
      }

      const result = await defineComponent.method.call(mockContext, options, {
        values: extraValues,
        element: mockElement,
        document: mockDocument
      })

      assert.deepStrictEqual(result.__script__.values, { title: 'Test Title' })
      assert.ok(!('count' in result.__script__.values))
    })

    it('should remove __script__ when script is undefined', async () => {
      // First call with script
      let result = await defineComponent.method.call(mockContext, {
        client: {
          script: function (v) {
            return v.title
          }
        }
      }, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })
      assert.ok(result.__script__)

      // Second call without script
      result = await defineComponent.method.call(mockContext, {
        client: {
          script: undefined
        }
      }, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })
      assert.strictEqual(result.__script__, undefined)
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
      assert.ok(!('polluted' in result))
    })

    it('should handle async token rejection', async () => {
      const options = {
        tokens: {
          failing: async () => {
            throw new Error('Async error')
          }
        }
      }
      await assert.rejects(async () => {
        await defineComponent.method.call(mockContext, options, {
          values: mockValues,
          element: mockElement,
          document: mockDocument
        })
      }, /Async error/)
    })

    it('should handle sync function throwing error', async () => {
      const options = {
        tokens: {
          throwing: () => {
            throw new Error('Sync error')
          }
        }
      }
      await assert.rejects(async () => {
        await defineComponent.method.call(mockContext, options, {
          values: mockValues,
          element: mockElement,
          document: mockDocument
        })
      }, /Sync error/)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large token values', async () => {
      const largeString = 'x'.repeat(10000)
      const options = {
        tokens: { large: largeString }
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
        tokens: { unicode: 'Hello 世界 🌍' }
      }
      const result = await defineComponent.method.call(mockContext, options, {
        values: mockValues,
        element: mockElement,
        document: mockDocument
      })
      assert.strictEqual(result.unicode, 'Hello 世界 🌍')
    })

    it('should handle circular references in values', async () => {
      const circularValues = { title: 'Test' }
      circularValues.self = circularValues
      const options = {
        tokens: { ref: (values) => values.title }
      }
      const result = await defineComponent.method.call(mockContext, options, {
        values: circularValues,
        element: mockElement,
        document: mockDocument
      })
      assert.strictEqual(result.ref, 'Test')
    })
  })
})
