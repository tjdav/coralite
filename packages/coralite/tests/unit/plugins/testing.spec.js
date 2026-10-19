import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { testingPlugin, createTestingPlugin } from '../../../plugins/testing.js'

// Each spec file runs in its own process, so mutating this env var here is parallel-safe.
function withEnv (name, value, fn) {
  const original = process.env[name]
  process.env[name] = value
  try {
    fn()
  } finally {
    if (original === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = original
    }
  }
}

function tagNode (attribs = {}, children = []) {
  return { type: 'tag', name: 'div', attribs: { ...attribs }, children }
}

describe('testingPlugin', () => {
  const appDev = { options: { mode: 'development' } }
  const appTest = { options: { mode: 'testing' } }
  const appProd = { options: { mode: 'production' } }

  it('should preserve authored data-testid without prefixing in development and testing', () => {
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

      assert.strictEqual(template.children[0].attribs['data-testid'], 'my-div')
    }
  })

  it('should preserve authored data-testid on page set without prefixing', () => {
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

      assert.strictEqual(elements.root.children[0].attribs['data-testid'], 'page-div')
    }
  })

  it('should strip data-testid in production by default', () => {
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

  it('should preserve data-testid in production mode when CORALITE_PRESERVE_TESTID is true', () => {
    withEnv('CORALITE_PRESERVE_TESTID', 'true', () => {
      const elements = {
        root: {
          children: [tagNode({ 'data-testid': 'page-div' })]
        }
      }

      testingPlugin.server.onPageSet({
        elements,
        app: appProd
      })

      assert.strictEqual(elements.root.children[0].attribs['data-testid'], 'page-div')
    })
  })

  it('should preserve data-testid in production mode when preserveTestId: true is configured', () => {
    const customPlugin = createTestingPlugin({ preserveTestId: true })
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

    customPlugin.server.onPageSet({
      elements,
      app: appProd
    })

    assert.strictEqual(elements.root.children[0].attribs['data-testid'], 'page-div')
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

  it('should not auto-inject positional auto-IDs on untagged interactive elements', () => {
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

      assert.strictEqual(template.children[0].attribs['data-testid'], undefined)
      assert.strictEqual(template.children[1].attribs['data-testid'], undefined)
    }
  })

  it('should handle dynamic tokens in data-testid verbatim', () => {
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

      testingPlugin.server.onBeforeComponentRender({
        instanceId: 'comp-0',
        template,
        app
      })

      assert.strictEqual(template.children[0].attribs['data-testid'], 'btn-{{ id }}')
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

  it('should perform a final safety pass in production to strip data-testid for objects and arrays', () => {
    const resultObj = {
      children: [
        {
          type: 'tag',
          name: 'div',
          attribs: { 'data-testid': 'stray-id', test: 'old-test' },
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
      result: resultObj,
      app: appProd
    })

    assert.strictEqual(resultObj.children[0].attribs['data-testid'], undefined)
    assert.strictEqual(resultObj.children[0].attribs.test, undefined)
    assert.strictEqual(resultObj.children[0].children[0].attribs['data-testid'], undefined)

    const resultArray = [
      {
        type: 'tag',
        name: 'div',
        attribs: { 'data-testid': 'array-stray' }
      }
    ]

    testingPlugin.server.onAfterComponentRender({
      result: resultArray,
      app: appProd
    })

    assert.strictEqual(resultArray[0].attribs['data-testid'], undefined)
  })

  it('should strip test attributes onComponentSet and onComponentUpdate in production mode by default', () => {
    const component = {
      template: {
        children: [
          {
            type: 'tag',
            name: 'button',
            attribs: { 'data-testid': 'action-btn', test: 'legacy-btn' }
          }
        ]
      },
      values: {
        attributes: [
          { name: 'data-testid', value: 'action-btn' },
          { name: 'test', value: 'legacy-btn' },
          { name: 'class', value: 'btn-primary' }
        ]
      }
    }

    testingPlugin.server.onComponentSet({
      component,
      app: appProd
    })

    assert.strictEqual(component.template.children[0].attribs['data-testid'], undefined)
    assert.strictEqual(component.template.children[0].attribs.test, undefined)
    assert.strictEqual(component.values.attributes.length, 1)
    assert.strictEqual(component.values.attributes[0].name, 'class')

    const module = {
      template: {
        children: [
          {
            type: 'tag',
            name: 'div',
            attribs: { 'data-testid': 'card-container' }
          }
        ]
      },
      values: {
        attributes: [
          { name: 'data-testid', value: 'card-container' }
        ]
      }
    }

    testingPlugin.server.onComponentUpdate({
      module,
      app: appProd
    })

    assert.strictEqual(module.template.children[0].attribs['data-testid'], undefined)
    assert.strictEqual(module.values.attributes.length, 0)
  })

  it('should preserve data-testid onComponentSet in production mode when CORALITE_PRESERVE_TESTID is true', () => {
    withEnv('CORALITE_PRESERVE_TESTID', 'true', () => {
      const component = {
        template: {
          children: [
            {
              type: 'tag',
              name: 'button',
              attribs: { 'data-testid': 'action-btn', test: 'legacy-btn' }
            }
          ]
        },
        values: {
          attributes: [
            { name: 'data-testid', value: 'action-btn' },
            { name: 'test', value: 'legacy-btn' },
            { name: 'class', value: 'btn-primary' }
          ]
        }
      }

      testingPlugin.server.onComponentSet({
        component,
        app: appProd
      })

      assert.strictEqual(component.template.children[0].attribs['data-testid'], 'action-btn')
      assert.strictEqual(component.template.children[0].attribs.test, undefined)
      assert.strictEqual(component.values.attributes.length, 2)
      assert.strictEqual(component.values.attributes[0].name, 'data-testid')
      assert.strictEqual(component.values.attributes[1].name, 'class')
    })
  })

  it('should preserve data-testid in production mode when app.options.preserveTestId is true', () => {
    const cases = [
      {
        hook: 'onPageSet',
        args: () => ({ elements: { root: { children: [tagNode({ 'data-testid': 'page-div' })] } } }),
        check: (args) => assert.strictEqual(args.elements.root.children[0].attribs['data-testid'], 'page-div')
      },
      {
        hook: 'onBeforeComponentRender',
        args: () => ({ template: { children: [tagNode({ 'data-testid': 'my-div' })] } }),
        check: (args) => assert.strictEqual(args.template.children[0].attribs['data-testid'], 'my-div')
      },
      {
        hook: 'onComponentSet',
        args: () => ({
          component: {
            template: { children: [tagNode({ 'data-testid': 'action-btn' })] },
            values: { attributes: [{ name: 'data-testid', value: 'action-btn' }] }
          }
        }),
        check: (args) => {
          assert.strictEqual(args.component.template.children[0].attribs['data-testid'], 'action-btn')
          assert.strictEqual(args.component.values.attributes.length, 1)
        }
      }
    ]

    for (const { hook, args, check } of cases) {
      const hookArgs = args()
      testingPlugin.server[hook]({
        ...hookArgs,
        app: { options: { mode: 'production', preserveTestId: true } }
      })
      check(hookArgs)
    }
  })
})
