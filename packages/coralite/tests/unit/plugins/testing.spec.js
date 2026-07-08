import { describe, it } from 'node:test'
import assert from 'node:assert'
import { testingPlugin } from '../../../plugins/testing.js'

describe('testingPlugin', () => {
  const appDev = { options: { mode: 'development' } }
  const appTest = { options: { mode: 'testing' } }
  const appProd = { options: { mode: 'production' } }

  it('should prefix data-testid on component render in development and testing', () => {
    for (const app of [appDev, appTest]) {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: {
              'data-testid': 'my-div'
            }
          }
        ]
      }

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        template,
        app
      })

      assert.strictEqual(template.children[0].attribs['data-testid'], 'comp-0__my-div')
    }
  })

  it('should prefix data-testid with page__ on page set in development and testing', () => {
    for (const app of [appDev, appTest]) {
      const elements = {
        root: {
          children: [
            {
              type: 'tag',
              name: 'div',
              attribs: {
                'data-testid': 'page-div'
              }
            }
          ]
        }
      }

      testingPlugin.server.onPageSet({
        elements,
        app
      })

      assert.strictEqual(elements.root.children[0].attribs['data-testid'], 'page__page-div')
    }
  })

  it('should strip data-testid in production', () => {
    const elements = {
      root: {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: {
              'data-testid': 'page-div'
            }
          }
        ]
      }
    }

    testingPlugin.server.onPageSet({
      elements,
      app: appProd
    })

    assert.strictEqual(elements.root.children[0].attribs['data-testid'], undefined)
  })

  it('should strip deprecated test attribute in all modes', () => {
    const elements = {
      root: {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: {
              test: 'my-test'
            }
          }
        ]
      }
    }

    // Dev
    testingPlugin.server.onPageSet({
      elements,
      app: appDev
    })
    assert.strictEqual(elements.root.children[0].attribs.test, undefined)

    // Test
    elements.root.children[0].attribs.test = 'my-test'
    testingPlugin.server.onPageSet({
      elements,
      app: appTest
    })
    assert.strictEqual(elements.root.children[0].attribs.test, undefined)

    // Prod
    elements.root.children[0].attribs.test = 'my-test'
    testingPlugin.server.onPageSet({
      elements,
      app: appProd
    })
    assert.strictEqual(elements.root.children[0].attribs.test, undefined)
  })

  it('should add deterministic testids to interactive elements in development and testing', () => {
    for (const app of [appDev, appTest]) {
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
          }
        ]
      }

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        template,
        app
      })

      assert.strictEqual(template.children[0].attribs['data-testid'], 'comp-0__button-0')
      assert.strictEqual(template.children[1].attribs['data-testid'], 'comp-0__a-0')
    }
  })

  it('should handle dynamic tokens in data-testid', () => {
    for (const app of [appDev, appTest]) {
      const template = {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: {
              'data-testid': 'btn-{{ id }}'
            }
          }
        ]
      }
      const attributes = [
        {
          name: 'data-testid',
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
        app
      })

      // Token name should NOT be prefixed (instruction violation fix)
      assert.strictEqual(attributes[0].tokens[0].name, 'id')
      // Attribute value in AST should be prefixed
      assert.strictEqual(template.children[0].attribs['data-testid'], 'comp-0__btn-{{ id }}')
    }
  })

  it('should strictly disable animations only in testing mode', () => {
    appDev.options.externalStyles = []
    testingPlugin.server.onBeforeBuild({ app: appDev })
    assert.strictEqual(appDev.options.externalStyles.length, 0)

    appTest.options.externalStyles = []
    testingPlugin.server.onBeforeBuild({ app: appTest })
    assert.strictEqual(appTest.options.externalStyles.length, 1)
    assert.ok(appTest.options.externalStyles[0].startsWith('data:text/css;base64,'))
  })

  it('should perform a final safety pass in production to strip data-testid', () => {
    const result = {
      children: [
        {
          type: 'tag',
          name: 'div',
          attribs: { 'data-testid': 'stray-id' },
          children: [
            {
              type: 'tag',
              name: 'span',
              attribs: { 'data-testid': 'nested-stray' }
            }
          ]
        }
      ]
    }

    testingPlugin.server.onAfterComponentRender({
      result,
      app: appProd
    })

    assert.strictEqual(result.children[0].attribs['data-testid'], undefined)
    assert.strictEqual(result.children[0].children[0].attribs['data-testid'], undefined)
  })
})
