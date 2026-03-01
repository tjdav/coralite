import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Coralite from '#lib'

describe('Coralite', () => {
  let testDir
  let pagesDir
  let templatesDir
  let coralite

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-'))
    pagesDir = path.join(testDir, 'pages')
    templatesDir = path.join(testDir, 'templates')

    await mkdir(pagesDir)
    await mkdir(templatesDir)

    // Create a basic page
    await writeFile(path.join(pagesDir, 'index.html'), '<h1>Hello World</h1>')

    // Create a basic template
    await writeFile(path.join(templatesDir, 'layout.html'), '<slot></slot>')
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  describe('onBeforeBuild hook', () => {
    it('should be called before the build starts with path and options', async () => {
      let hookCalled = false
      let hookContext = null

      const plugin = {
        name: 'test-before-build-plugin',
        onBeforeBuild: async (context) => {
          hookCalled = true
          hookContext = context

          // Test mutation
          if (context.options) {
            context.options.variables = { injected: 'value' }
          }
        }
      }

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        plugins: [plugin]
      })

      await coralite.initialise()

      const buildOptions = { maxConcurrent: 5 }
      await coralite.build(pagesDir, buildOptions)

      assert.ok(hookCalled, 'onBeforeBuild hook should be called')
      assert.ok(hookContext, 'context should be passed to the hook')
      assert.strictEqual(hookContext.path, pagesDir, 'path should be passed')
      assert.strictEqual(hookContext.options, buildOptions, 'options should be passed')
      assert.strictEqual(buildOptions.variables.injected, 'value', 'options should be mutable')
    })
  })

  describe('onBeforePageRender hook', () => {
    it('should be called before rendering each page with document, values, and renderContext', async () => {
      let hookCalledCount = 0
      let hookContext = null

      const plugin = {
        name: 'test-before-page-render-plugin',
        onBeforePageRender: async (context) => {
          hookCalledCount++
          hookContext = context

          // Test mutation
          context.values.injectedGlobal = 'test'

          // Modifying AST
          context.document.root.children.push({
            type: 'tag',
            name: 'div',
            attribs: { class: 'injected' },
            children: []
          })
        }
      }

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        plugins: [plugin]
      })

      await coralite.initialise()
      const results = await coralite.build()

      assert.strictEqual(hookCalledCount, 1, 'onBeforePageRender hook should be called exactly once for 1 page')
      assert.ok(hookContext, 'context should be passed to the hook')
      assert.ok(hookContext.document, 'document should be present in context')
      assert.ok(hookContext.values, 'values should be present in context')
      assert.ok(hookContext.renderContext, 'renderContext should be present in context')

      const html = results[0].html
      assert.ok(html.includes('class="injected"'), 'AST modifications should be present in the final HTML')
    })
  })

  describe('Ignore/Skip Attributes', () => {
    it('should drop elements from AST when they match ignoreByAttribute', async () => {
      await writeFile(path.join(pagesDir, 'ignore.html'), '<div><span data-ignore="true">Ignored</span><span data-keep="true">Kept</span></div>')

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        ignoreByAttribute: [{
          name: 'data-ignore',
          value: 'true'
        }]
      })

      await coralite.initialise()

      const result = await coralite.build('ignore.html')

      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].html.includes('Ignored'), false)
      assert.strictEqual(result[0].html.includes('Kept'), true)
    })

    it('should parse elements but remove them from render output when they match skipRenderByAttribute', async () => {
      await writeFile(path.join(pagesDir, 'skip.html'), '<div><test-component data-skip="true"></test-component><span data-keep="true">Kept</span></div>')
      await writeFile(path.join(templatesDir, 'test-component.html'), '<span id="rendered-test-component">Test Component</span>')

      let testComponentRendered = false

      const testPlugin = {
        name: 'test-plugin',
        onBeforePageRender: (context) => {
          // Verify it's in the document before rendering
          const hasTestComponent = context.document.customElements.some(el => el.name === 'test-component')
          if (hasTestComponent) {
            testComponentRendered = true
          }
        }
      }

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        plugins: [testPlugin],
        skipRenderByAttribute: ['data-skip']
      })

      await coralite.initialise()

      const result = await coralite.build('skip.html')

      assert.strictEqual(result.length, 1)
      assert.strictEqual(testComponentRendered, true, 'Test component should have been parsed and kept in the custom elements list')
      assert.strictEqual(result[0].html.includes('rendered-test-component'), false, 'Test component should not be in the final HTML')
      assert.strictEqual(result[0].html.includes('Test Component'), false, 'Test component should not be in the final HTML')
      assert.strictEqual(result[0].html.includes('Kept'), true, 'Elements without skip attribute should be kept')
      assert.strictEqual(result[0].html.includes('<test-component'), false, 'Test component should not be in the final HTML')
    })
  })

  describe('onAfterBuild hook', () => {
    it('should be called after a successful build', async () => {
      let hookCalled = false
      let hookContext = null

      const plugin = {
        name: 'test-plugin',
        onAfterBuild: async (context) => {
          hookCalled = true
          hookContext = context
        }
      }

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        plugins: [plugin]
      })

      await coralite.initialise()
      await coralite.build()

      assert.ok(hookCalled, 'onAfterBuild hook should be called')
      assert.ok(hookContext, 'context should be passed to the hook')
      assert.ok(Array.isArray(hookContext.results), 'results should be an array')
      assert.strictEqual(hookContext.results.length, 1, 'should have 1 result')
      assert.strictEqual(hookContext.error, null, 'error should be null on success')
      assert.ok(typeof hookContext.duration === 'number', 'duration should be a number')
    })

    it('should be called after a failed build with error', async () => {
      let hookCalled = false
      let hookContext = null

      const plugin = {
        name: 'test-plugin',
        onAfterBuild: async (context) => {
          hookCalled = true
          hookContext = context
        }
      }

      const errorPlugin = {
        name: 'error-plugin',
        onAfterPageRender: async () => {
          throw new Error('Test Error')
        }
      }

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        plugins: [plugin, errorPlugin]
      })

      await coralite.initialise()

      try {
        await coralite.build()
      } catch (e) {
        // Expected error
      }

      assert.ok(hookCalled, 'onAfterBuild hook should be called even on error')
      assert.ok(hookContext.error, 'error should be present')
      assert.ok(hookContext.error.message.includes('Test Error'), 'error message should match')
      assert.ok(typeof hookContext.duration === 'number', 'duration should be a number')
    })
  })
})
