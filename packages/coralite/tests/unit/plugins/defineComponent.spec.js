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

  // it('should handle slot computation', async () => {
  //   const options = {
  //     slots: {
  //       header: (content, values) => `<h1>${values.title || 'Default'}</h1>`
  //     }
  //   }

  //   const values = { title: 'Test Title' }
  //   const element = {
  //     slots: [
  //       {
  //         name: 'header',
  //         node: {
  //           type: 'text',
  //           data:
  //             'some content'
  //         }
  //       }
  //     ]
  //   }
  //   const document = {}

  //   const result = await defineComponent.method.call(mockContext, options, {
  //     values,
  //     element,
  //     document
  //   })

  //   assert.ok(result.slots)
  // })

  // it('should handle script inclusion with values', async () => {
  //   const scriptFunction = function (values) {
  //     return `console.log(${values.message || 'default'})`
  //   }

  //   const options = {
  //     script: scriptFunction
  //   }

  //   const values = { message: 'Hello World' }
  //   const element = {}
  //   const document = {}

  //   const result = await defineComponent.method.call(mockContext, options, {
  //     values,
  //     element,
  //     document
  //   })

  //   assert.ok(result.scriptTextContent)
  //   assert.match(result.scriptTextContent, /console\.log\("Hello World"\)/)
  // })

  // it('should remove script when not provided', async () => {
  //   const options = {}

  //   const values = {}
  //   const element = {}
  //   const document = {}

  //   const result = await defineComponent.method.call(mockContext, options, {
  //     values,
  //     element,
  //     document
  //   })

  //   assert.ok(!result.scriptTextContent)
  // })
})
