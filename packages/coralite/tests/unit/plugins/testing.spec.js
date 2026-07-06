import { describe, it } from 'node:test'
import assert from 'node:assert'
import { testingPlugin } from '../../../plugins/testing.js'

describe('testingPlugin', () => {
  const app = { options: { mode: 'development' } }

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

    testingPlugin.server.onBeforeComponentRender({
      instanceId: '',
      template: component.template,
      app
    })

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

    testingPlugin.server.onPageSet({
      elements,
      app
    })

    assert.strictEqual(elements.root.children[0].attribs['data-testid'], 'page__pageRef')
  })

  it('should transform test attribute to data-testid on page set in testing mode', () => {
    const elements = {
      root: {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {
              test: 'page-btn'
            }
          }
        ]
      }
    }

    testingPlugin.server.onPageSet({
      elements,
      app: { options: { mode: 'testing' } }
    })

    assert.strictEqual(elements.root.children[0].attribs['data-testid'], 'page__page-btn')
    assert.strictEqual(elements.root.children[0].attribs.test, undefined)
  })

  it('should strip test attribute on page set in production mode', () => {
    const elements = {
      root: {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {
              test: 'page-btn'
            }
          }
        ]
      }
    }

    testingPlugin.server.onPageSet({
      elements,
      app: { options: { mode: 'production' } }
    })

    assert.strictEqual(elements.root.children[0].attribs['data-testid'], undefined)
    assert.strictEqual(elements.root.children[0].attribs.test, undefined)
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

    testingPlugin.server.onBeforeComponentRender({
      instanceId: '',
      template: component.template,
      app
    })

    assert.strictEqual(component.template.children[0].attribs['data-testid'], undefined)
    assert.strictEqual(component.template.children[0].children[0].attribs['data-testid'], 'nestedBtn')
  })

  it('should handle missing template gracefully', () => {
    const component = {}
    testingPlugin.server.onBeforeComponentRender({
      instanceId: '',
      template: component.template,
      app
    })
    // Should not throw
    assert.ok(true)
  })

  it('should not overwrite existing data-testid attribute on component set', () => {
    const component = {
      template: {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: {
              ref: 'myRef',
              'data-testid': 'customId'
            }
          }
        ]
      }
    }

    testingPlugin.server.onBeforeComponentRender({
      instanceId: '',
      template: component.template,
      app
    })

    assert.strictEqual(component.template.children[0].attribs['data-testid'], 'customId')
  })

  it('should not overwrite existing non-ref data-testid in onBeforeComponentRender', () => {
    const element = {
      attribs: {
        ref: 'myRef',
        'data-testid': 'customId'
      }
    }
    const refs = [{
      name: 'myRef',
      element
    }]
    testingPlugin.server.onBeforeComponentRender({
      instanceId: 'comp-0',
      refs,
      app
    })
    assert.strictEqual(element.attribs['data-testid'], 'customId')
  })

  describe('testing mode', () => {
    const appTesting = { options: { mode: 'testing' } }

    it('should add deterministic testids to interactive elements', () => {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {}
          },
          {
            type: 'tag',
            name: 'a',
            attribs: { href: '#' }
          },
          {
            type: 'tag',
            name: 'div',
            attribs: { tabindex: '0' }
          },
          {
            type: 'tag',
            name: 'span',
            attribs: { role: 'button' }
          }
        ]
      }

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        refs: [],
        template,
        app: appTesting
      })

      assert.strictEqual(template.children[0].attribs['data-testid'], 'comp-0__button-0')
      assert.strictEqual(template.children[1].attribs['data-testid'], 'comp-0__a-0')
      assert.strictEqual(template.children[2].attribs['data-testid'], 'comp-0__div-0')
      assert.strictEqual(template.children[3].attribs['data-testid'], 'comp-0__span-0')
    })

    it('should increment counters correctly', () => {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {}
          },
          {
            type: 'tag',
            name: 'button',
            attribs: {}
          }
        ]
      }

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        refs: [],
        template,
        app: appTesting
      })

      assert.strictEqual(template.children[0].attribs['data-testid'], 'comp-0__button-0')
      assert.strictEqual(template.children[1].attribs['data-testid'], 'comp-0__button-1')
    })

    it('should transform test attribute into data-testid', () => {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {
              test: 'my-btn'
            }
          }
        ]
      }

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        template,
        app: appTesting
      })

      assert.strictEqual(template.children[0].attribs['data-testid'], 'comp-0__my-btn')
      assert.strictEqual(template.children[0].attribs.test, undefined)
    })

    it('should support dynamic tokens in test attribute', () => {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {
              test: 'btn-{{ id }}'
            }
          }
        ]
      }
      const attributes = [
        {
          name: 'test',
          element: template.children[0],
          tokens: [
            {
              name: 'id',
              content: '{{ id }}'
            }
          ]
        }
      ]

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        template,
        attributes,
        app: appTesting
      })

      assert.strictEqual(attributes[0].name, 'data-testid')
      assert.strictEqual(attributes[0].tokens[0].content, '{{ id }}')
      assert.strictEqual(attributes[0].tokens[0].name, 'comp-0__id')
      assert.strictEqual(template.children[0].attribs['data-testid'], 'comp-0__btn-{{ comp-0__id }}')
    })
  })

  describe('production mode', () => {
    const appProd = { options: { mode: 'production' } }

    it('should strip test attribute', () => {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {
              test: 'my-btn'
            }
          }
        ]
      }

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        template,
        app: appProd
      })

      assert.strictEqual(template.children[0].attribs['data-testid'], undefined)
      assert.strictEqual(template.children[0].attribs.test, undefined)
    })

    it('should NOT strip test attribute in onBeforeComponentRender if it has tokens', () => {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {
              test: 'btn-{{ id }}'
            }
          }
        ]
      }
      const attributes = [
        {
          name: 'test',
          element: template.children[0],
          tokens: [
            {
              name: 'id',
              content: '{{ id }}'
            }
          ]
        }
      ]

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        template,
        attributes,
        app: appProd
      })

      // It should NOT be stripped yet, so renderer can replace the token
      assert.strictEqual(template.children[0].attribs.test, 'btn-{{ id }}')
    })
  })
})
