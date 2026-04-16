import { describe, it } from 'node:test'
import assert from 'node:assert'
import { testingPlugin } from '../../../plugins/testing.js'

describe('testingPlugin', () => {
  it('should copy ref attribute to data-testid on component set', () => {
    const component = {
      template: {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: {
              ref: 'myRef'
            }
          },
          {
            type: 'tag',
            name: 'span',
            attribs: {
              class: 'test'
            }
          }
        ]
      }
    }

    testingPlugin.onComponentSet(component)

    assert.strictEqual(component.template.children[0].attribs['data-testid'], 'myRef')
    assert.strictEqual(component.template.children[1].attribs['data-testid'], undefined)
  })

  it('should copy ref attribute to data-testid on page set', () => {
    const elements = {
      root: {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: {
              ref: 'pageRef'
            }
          }
        ]
      }
    }

    testingPlugin.onPageSet({ elements })

    assert.strictEqual(elements.root.children[0].attribs['data-testid'], 'pageRef')
  })

  it('should traverse recursively and copy refs to data-testid', () => {
    const component = {
      template: {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: { class: 'wrapper' },
            children: [
              {
                type: 'tag',
                name: 'button',
                attribs: { ref: 'nestedBtn' }
              }
            ]
          }
        ]
      }
    }

    testingPlugin.onComponentSet(component)

    assert.strictEqual(component.template.children[0].attribs['data-testid'], undefined)
    assert.strictEqual(component.template.children[0].children[0].attribs['data-testid'], 'nestedBtn')
  })

  it('should handle missing template gracefully', () => {
    const component = {}
    testingPlugin.onComponentSet(component)
    // Should not throw
    assert.ok(true)
  })
})
