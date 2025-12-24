import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { defineComponent } from '../../../plugins/define-component.js'

// Mock helpers to simulate Coralite environment
const mockCreateComponent = (componentData) => {
  return Promise.resolve({
    children: [
      {
        type: 'tag',
        name: 'div',
        attribs: [],
        children: [{
          type: 'text',
          data: componentData.content
        }]
      }
    ]
  })
}

const mockParseHTML = (html, excludeByAttribute) => {
  // Simple mock - in reality this would parse HTML and extract custom elements
  return {
    root: { children: [] },
    customElements: []
  }
}

// Mock Coralite environment
const mockContext = {
  createComponent: mockCreateComponent,
  parseHTML: mockParseHTML
}

describe('defineComponent', () => {
  it('should handle basic token computation', async () => {
    const options = {
      tokens: {
        title: 'Hello World',
        count: (values) => values.count || 0
      }
    }

    const values = { count: 5 }
    const element = {}
    const document = {}

    // Mock the method context with our test helpers
    const context = {
      ...mockContext,
      createComponent: mockCreateComponent,
      parseHTML: mockParseHTML
    }

    const result = await defineComponent.method.call(context, options, {
      values,
      element,
      document
    })

    assert.equal(result.title, 'Hello World')
    assert.equal(result.count, 5)
  })

  it('should handle async token computation', async () => {
    const options = {
      tokens: {
        asyncData: async () => {
          return new Promise((resolve) => setTimeout(() => resolve('async value'), 10))
        }
      }
    }

    const values = {}
    const element = {}
    const document = {}

    const result = await defineComponent.method.call(mockContext, options, {
      values,
      element,
      document
    })

    assert.ok(Array.isArray(result.asyncData))
    assert.ok(typeof result.asyncData[0] === 'object')
    assert.equal(result.asyncData[0].type, 'text')
    assert.equal(result.asyncData[0].data, 'async value')
  })

  it('should process string tokens as HTML', async () => {
    const options = {
      tokens: {
        content: '<p>Test paragraph</p>'
      }
    }

    // Mock parseHTML to return parsed structure
    const mockParseHTMLWithCustomElements = (html, excludeByAttribute) => {
      return {
        root: {
          children: [{
            type: 'tag',
            name: 'p',
            children: [{
              type: 'text',
              data: 'Test paragraph'
            }]
          }]
        },
        customElements: []
      }
    }

    const context = {
      ...mockContext,
      parseHTML: mockParseHTMLWithCustomElements
    }

    const values = {}
    const element = {}
    const document = {}

    const result = await defineComponent.method.call(context, options, {
      values,
      element,
      document
    })

    assert.ok(Array.isArray(result.content))
    assert.equal(result.content[0].name, 'p')
  })

  it('should handle empty tokens object', async () => {
    const options = { tokens: {} }

    const values = {}
    const element = {}
    const document = {}

    const result = await defineComponent.method.call(mockContext, options, {
      values,
      element,
      document
    })

    assert.ok(result)
  })
})
