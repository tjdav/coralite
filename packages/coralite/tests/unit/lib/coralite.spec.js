import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCoraliteElement, createCoraliteTextNode } from '#lib'
import { createTestProject } from '../utils/project.js'

describe('Coralite', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()

    // Create a basic page
    await project.writePage('index.html', '<h1>Hello World</h1>')

    // Create a basic component
    await project.writeComponent('layout.html', '<slot></slot>')
  })

  afterEach(async () => {
    await project.cleanup()
  })

  describe('Plugins Initialization', () => {
    it('should unshift staticAssetPlugin when assets option is provided', async () => {
      const assets = [
        {
          pkg: 'some-pkg',
          path: 'src/file.js',
          dest: 'dest/file.js'
        }
      ]

      const coralite = await project.createCoralite({
        assets
      })

      // plugins array should have static-asset-plugin as the first item
      assert.strictEqual(coralite.options.plugins[0].name, 'static-asset-plugin')
      // Followed by core plugins
      assert.strictEqual(coralite.options.plugins[1].name, 'metadata')
    })
  })

  describe('onBeforeBuild hook', () => {
    it('should be called before the build starts with path and options', async () => {
      let hookCalled = false
      let hookContext = null

      const plugin = {
        name: 'test-before-build-plugin',
        server: {
          onBeforeBuild: async (context) => {
            hookCalled = true
            hookContext = context

            // Test mutation
            if (context.options) {
              context.options.variables = { injected: 'value' }
            }
          }
        }
      }

      const coralite = await project.createCoralite({
        plugins: [plugin]
      })


      const buildOptions = { maxConcurrent: 5 }
      await coralite.build(project.pagesDir, buildOptions)

      assert.ok(hookCalled, 'onBeforeBuild hook should be called')
      assert.ok(hookContext, 'context should be passed to the hook')
      assert.ok(hookContext.buildId, 'buildId should be passed')
      assert.strictEqual(hookContext.options, buildOptions, 'options should be passed')
      assert.strictEqual(buildOptions.variables.injected, 'value', 'options should be mutable')
    })
  })

  describe('onBeforePageRender hook', () => {
    it('should be called before rendering each page with component, state, and session', async () => {
      let hookCalledCount = 0
      let hookContext = null

      const plugin = {
        name: 'test-before-page-render-plugin',
        server: {
          onBeforePageRender: async (context) => {
            hookCalledCount++
            hookContext = context

            // Test mutation
            context.state.injectedGlobal = 'test'

            // Modifying AST
            context.component.root.children.push(createCoraliteElement({
              type: 'tag',
              name: 'div',
              attribs: { class: 'injected' },
              children: [],
              parent: context.component.root
            }))
          }
        }
      }

      const coralite = await project.createCoralite({
        plugins: [plugin]
      })

      const results = await coralite.build()

      assert.strictEqual(hookCalledCount, 1, 'onBeforePageRender hook should be called exactly once for 1 page')
      assert.ok(hookContext, 'context should be passed to the hook')
      assert.ok(hookContext.component, 'component should be present in context')
      assert.ok(hookContext.state, 'state should be present in context')
      assert.ok(hookContext.session, 'session should be present in context')

      const html = results[0].content
      assert.ok(html.includes('class="injected"'), 'AST modifications should be present in the final HTML')
    })
  })

  describe('Ignore/Skip Attributes', () => {
    it('should drop elements from AST when they match ignoreByAttribute (Object format)', async () => {
      await project.writePage('ignore.html', '<div><span data-ignore="true">Ignored</span><span data-keep="true">Kept</span></div>')

      const coralite = await project.createCoralite({
        ignoreByAttribute: [{
          name: 'data-ignore',
          value: 'true'
        }],
        output: path.join(project.testDir, 'ignore-out')
      })


      const result = await coralite.build('ignore.html')

      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].content.includes('Ignored'), false)
      assert.strictEqual(result[0].content.includes('Kept'), true)
    })

    it('should drop elements from AST when they match ignoreByAttribute (String format)', async () => {
      await project.writePage('ignore2.html', '<div><span data-ignore>Ignored</span><span data-keep="true">Kept</span></div>')

      const coralite = await project.createCoralite({
        ignoreByAttribute: ['data-ignore'],
        output: path.join(project.testDir, 'ignore-out-2')
      })


      const result = await coralite.build('ignore2.html')

      assert.strictEqual(result.length, 1)
      assert.strictEqual(result[0].content.includes('Ignored'), false)
      assert.strictEqual(result[0].content.includes('Kept'), true)
    })

    it('should parse elements but remove them from render output when they match skipRenderByAttribute (String format)', async () => {
      await project.writePage('skip.html', '<div><test-component data-skip></test-component><span data-keep="true">Kept</span></div>')
      await project.writeComponent('test-component.html', '<span id="rendered-test-component">Test Component</span>')

      let testComponentRendered = false

      const testPlugin = {
        name: 'test-plugin',
        server: {
          onBeforePageRender: (context) => {
            // Verify it's in the component before rendering
            const hasTestComponent = context.component.customElements.some(el => el.name === 'test-component')
            if (hasTestComponent) {
              testComponentRendered = true
            }
          }
        }
      }

      const coralite = await project.createCoralite({
        plugins: [testPlugin],
        skipRenderByAttribute: ['data-skip'],
        output: path.join(project.testDir, 'skip-out')
      })


      const result = await coralite.build('skip.html')

      assert.strictEqual(result.length, 1)
      assert.strictEqual(testComponentRendered, true, 'Test component should have been parsed and kept in the custom elements list')
      assert.strictEqual(result[0].content.includes('rendered-test-component'), false, 'Test component should not be in the final HTML')
      assert.strictEqual(result[0].content.includes('Test Component'), false, 'Test component should not be in the final HTML')
      assert.strictEqual(result[0].content.includes('Kept'), true, 'Elements without skip attribute should be kept')
      assert.strictEqual(result[0].content.includes('<test-component'), false, 'Test component should not be in the final HTML')
    })
  })

  describe('save() method', () => {
    it('should save assets to the assets directory', async () => {
      const outputDir = project.outputDir

      // Need a component with a script so that it generates an asset chunk
      await project.writeComponent('script-component.html', `
        <template id="script-component">
          <div>Script Component</div>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite'
          export default defineComponent({
            client () {
              console.log('test')
            }
          })
        </script>
      `)

      await project.writePage('with-script.html', '<script-component></script-component>')

      const coralite = await project.createCoralite({
        mode: 'development',
        output: outputDir
      })

      await coralite.save()

      // Read output directory contents
      const fs = await import('node:fs/promises')
      const assetsPath = path.join(outputDir, 'assets', 'js')

      try {
        const stats = await fs.stat(assetsPath)
        assert.ok(stats.isDirectory(), 'assets directory should have been created')

        const files = await fs.readdir(assetsPath)
        assert.ok(files.length > 0, 'assets directory should contain at least one chunk file')

        // Verify the orchestrator in the HTML file points to the right chunk
        const htmlContent = await fs.readFile(path.join(outputDir, 'with-script.html'), 'utf-8')
        assert.ok(htmlContent.includes('/assets/js/coralite-runtime'), 'HTML orchestrator should reference the assets directory')
      } catch (err) {
        assert.fail(`Asset directory or files missing: ${err.message}`)
      }
    })
  })

  describe('onAfterBuild hook', () => {
    it('should be called after a successful build', async () => {
      let hookCalled = false
      let hookContext = null

      const plugin = {
        name: 'test-plugin',
        server: {
          onAfterBuild: async (context) => {
            hookCalled = true
            hookContext = context
          }
        }
      }

      const coralite = await project.createCoralite({
        plugins: [plugin],
        output: '/'
      })

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
        server: {
          onAfterBuild: async (context) => {
            hookCalled = true
            hookContext = context
          }
        }
      }

      const errorPlugin = {
        name: 'error-plugin',
        server: {
          onAfterPageRender: async () => {
            throw new Error('Test Error')
          }
        }
      }

      // swallow the error so it doesn't crash the test runner
      const coralite = await project.createCoralite({
        plugins: [plugin, errorPlugin],
        onError: () => {
        }
      })


      try {
        await coralite.build()
      } catch (_err) {
        // Expected error
      }

      assert.ok(hookCalled, 'onAfterBuild hook should be called even on error')
      assert.ok(hookContext.error, 'error should be present')
      assert.ok(hookContext.error.message.includes('Test Error'), 'error message should match')
      assert.ok(typeof hookContext.duration === 'number', 'duration should be a number')
    })
    describe('Asset Tracking', () => {
      it('should track output files manually', async () => {
        const coralite = await project.createCoralite({
          output: project.outputDir
        })

        const testFile = path.join(project.outputDir, 'manual-track.txt')
        coralite.trackOutputFile(testFile)

        const tracked = coralite.getTrackedOutputFiles()
        assert.ok(tracked.includes(path.normalize(testFile)), 'Should track manual output file')
      })

      it('should write and track files via app.writeFile', async () => {
        const coralite = await project.createCoralite({
          output: project.outputDir
        })

        const content = 'test content'
        const relativePath = 'nested/dir/test.txt'
        const absolutePath = await coralite.writeFile(relativePath, content)

        assert.strictEqual(absolutePath, path.join(project.outputDir, relativePath))

        const fs = await import('node:fs/promises')
        const writtenContent = await fs.readFile(absolutePath, 'utf-8')
        assert.strictEqual(writtenContent, content, 'File content should match')

        const tracked = coralite.getTrackedOutputFiles()
        assert.ok(tracked.includes(path.normalize(absolutePath)), 'Should automatically track files written via writeFile')
      })

      it('should automatically track local externalStyles', async () => {
        const externalStyles = ['/assets/css/custom.css', 'https://example.com/remote.css']
        const coralite = await project.createCoralite({
          output: project.outputDir,
          externalStyles
        })

        const tracked = coralite.getTrackedOutputFiles()
        assert.ok(tracked.includes(path.normalize(path.join(project.outputDir, '/assets/css/custom.css'))), 'Should track local external style')
        assert.ok(!tracked.some(t => t.includes('remote.css')), 'Should NOT track remote external style')
      })
    })
  })
})

describe('Bug Fix: Preserving recursive tokens', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('preserves state context into child components nested dependencies', async () => {
    const parentPlugin = {
      name: 'parent-plugin',
      server: {
        onPageSet: async ({ state }) => {
          state.special_value = 'i-am-preserved'
        }
      }
    }

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const fixtureDir = path.join(__dirname, '../../fixtures/nested-dependencies')

    const coralite = await project.createCoralite({
      pages: fixtureDir,
      components: fixtureDir,
      output: project.outputDir,
      plugins: [parentPlugin],
      mode: 'production',
      baseURL: '/'
    })

    const results = await coralite.build()

    const pageResult = results.find(r => r.path && r.path.filename === 'nested-dependencies-page.html')
    const htmlOutput = pageResult ? pageResult.content : ''
    assert.ok(htmlOutput.includes('i-am-preserved'), 'nested child token state should receive context state')
  })

  it('allows plugins to inject state via onBeforeComponentRender', async () => {
    const plugin = {
      name: 'inject-plugin',
      server: {
        onBeforeComponentRender: async ({ state, componentId }) => {
          if (componentId === 'test-comp') {
            state.injected = 'plugin-value'
          }
        }
      }
    }

    await project.writePage('test-plugin.html', '<test-comp></test-comp>')
    await project.writeComponent('test-comp.html', '<template id="test-comp"><div>{{ injected }}</div></template>')

    const coralite = await project.createCoralite({
      plugins: [plugin],
      output: path.join(project.testDir, 'inject-out')
    })

    const results = await coralite.build('test-plugin.html')

    assert.ok(results[0].content.includes('plugin-value'))
  })

  it('allows plugins to mutate AST via onAfterComponentRender', async () => {
    const plugin = {
      name: 'mutate-plugin',
      server: {
        onAfterComponentRender: async ({ result, componentId }) => {
          if (componentId === 'test-comp') {
            result.appendChild(createCoraliteElement({
              type: 'tag',
              name: 'span',
              attribs: { id: 'extra' },
              children: [createCoraliteTextNode({
                type: 'text',
                data: 'extra-node'
              })]
            }))
          }
        }
      }
    }

    await project.writePage('test-plugin-ast.html', '<test-comp></test-comp>')
    await project.writeComponent('test-comp.html', '<template id="test-comp"><div>original</div></template>')

    const coralite = await project.createCoralite({
      plugins: [plugin],
      output: path.join(project.testDir, 'mutate-out')
    })

    const results = await coralite.build('test-plugin-ast.html')

    assert.ok(results[0].content.includes('id="extra"'))
    assert.ok(results[0].content.includes('extra-node'))
  })

  describe('Testing Mock System', () => {
    it('executes the mock server method instead of the original component server block and supplies the correct context', async () => {
      await project.writePage('test-mock.html', '<mocking-component user-id="123"></mocking-component>')
      await project.writeComponent('mocking-component.html', `
        <template id="mocking-component">
          <div>User: {{ name }} (Id: {{ userId }})</div>
        </template>
        <script type="module">
          import { defineComponent } from 'coralite';
          export default defineComponent({
            attributes: {
              userId: String
            },
            async server() {
              return { name: 'REAL_USER' }
            }
          })
        </script>
      `)

      let receivedContext = null

      const coralite = await project.createCoralite({
        mode: 'testing',
        testing: {
          mocks: {
            'mocking-component': {
              server: async (context) => {
                receivedContext = context
                return { name: 'MOCKED_USER' }
              }
            }
          }
        },
        output: path.join(project.testDir, 'mock-out')
      })

      const results = await coralite.build('test-mock.html')

      assert.strictEqual(results.length, 1)
      // Check that it rendered the mocked value and preserved the coerced attribute (wrapped in c-token tags in testing mode)
      assert.ok(results[0].content.includes('<c-token>MOCKED_USER</c-token>'))
      assert.ok(results[0].content.includes('<c-token>123</c-token>'))

      // Check that the mock server received the expected context
      assert.ok(receivedContext !== null, 'Mock server should receive context')
      assert.strictEqual(receivedContext.state.userId, '123', 'Context state should contain coerced attribute value')
      assert.ok(receivedContext.page, 'Context should contain page metadata')
      assert.ok(receivedContext.app, 'Context should contain app instance')
      assert.strictEqual(receivedContext.id, 'mocking-component-0', 'Context should contain unique instance ID')
    })
  })
})

