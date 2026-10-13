import { describe, it } from 'node:test'
import assert from 'node:assert'
import { extractRouteParams, validateEnumeratedPaths } from '../../../../../lib/server/page/route.js'
import { createPageHandlers } from '../../../../../lib/server/collection/handlers.js'
import { evaluate } from '../../../../../lib/server/compiler.js'

describe('Page route param extraction and paths validation', () => {
  describe('extractRouteParams', () => {
    it('extracts params from standard route filenames', () => {
      assert.deepStrictEqual(extractRouteParams('about.html'), {
        routeParams: [],
        isCatchAll: false
      })
      assert.deepStrictEqual(extractRouteParams('posts/[id].html'), {
        routeParams: ['id'],
        isCatchAll: false
      })
      assert.deepStrictEqual(extractRouteParams('posts/[id]/index.html'), {
        routeParams: ['id'],
        isCatchAll: false
      })
      assert.deepStrictEqual(extractRouteParams('[year]/[month].html'), {
        routeParams: ['year', 'month'],
        isCatchAll: false
      })
    })

    it('recognizes catch-all pattern [...slug]', () => {
      assert.deepStrictEqual(extractRouteParams('docs/[...slug].html'), {
        routeParams: ['slug'],
        isCatchAll: true
      })
    })
  })

  describe('validateEnumeratedPaths', () => {
    it('validates a correct array of param objects', () => {
      assert.doesNotThrow(() => {
        validateEnumeratedPaths([{ id: 'intro' }, { id: 'advanced' }], ['id'], '/pages/posts/[id].html')
      })
      assert.doesNotThrow(() => {
        validateEnumeratedPaths([], ['id'], '/pages/posts/[id].html')
      })
    })

    it('throws CORALITE-E402 if return value is not an array', () => {
      assert.throws(() => {
        validateEnumeratedPaths('invalid', ['id'], '/pages/posts/[id].html')
      }, (err) => err.code === 'CORALITE-E402' && err.message.includes('must return an array'))
    })

    it('throws CORALITE-E402 if an entry is not an object', () => {
      assert.throws(() => {
        validateEnumeratedPaths(['invalid'], ['id'], '/pages/posts/[id].html')
      }, (err) => err.code === 'CORALITE-E402' && err.message.includes('must be a param object'))
    })

    it('throws CORALITE-E402 if a required param is missing', () => {
      assert.throws(() => {
        validateEnumeratedPaths([{ slug: 'intro' }], ['id'], '/pages/posts/[id].html')
      }, (err) => err.code === 'CORALITE-E402' && err.message.includes('missing required route param'))
    })

    it('throws CORALITE-E402 if extra undeclared params are present', () => {
      assert.throws(() => {
        validateEnumeratedPaths([{
          id: 'intro',
          extra: 'x'
        }], ['id'], '/pages/posts/[id].html')
      }, (err) => err.code === 'CORALITE-E402' && err.message.includes('contains undeclared param'))
    })

    it('throws CORALITE-E402 if param value is not a string', () => {
      assert.throws(() => {
        validateEnumeratedPaths([{ id: 42 }], ['id'], '/pages/posts/[id].html')
      }, (err) => err.code === 'CORALITE-E402' && err.message.includes('must be a string'))
    })
  })

  describe('Collection handlers paths evaluation', () => {
    const createMockApp = (overrides = {}) => ({
      options: {
        path: {
          pages: '/pages',
          components: '/components'
        },
        ignoreByAttribute: [],
        skipRenderByAttribute: [],
        mode: 'development'
      },
      _dependencyGraph: {
        directPageComponents: {},
        pageCustomElements: {}
      },
      _refreshDependencyGraph: () => {
      },
      components: {
        getItem: () => null
      },
      source: {
        plugins: {},
        utils: {
          getHtmlFile: async () => ''
        }
      },
      pages: {
        list: []
      },
      ...overrides
    })

    const triggerHook = async (name, ctx) => ctx

    it('executes synchronous paths block returning valid params', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/posts/[id].html',
          dirname: '/pages/posts',
          filename: '[id].html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              paths () {
                return [{ id: 'intro' }, { id: 'advanced' }]
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.strictEqual(res.value.page.routePattern, '/posts/:id')
      assert.deepEqual(res.value.page.routeParams, ['id'])
      assert.deepEqual(res.value.page.routeSegments, [
        {
          type: 'static',
          value: 'posts'
        },
        {
          type: 'param',
          value: 'id'
        }
      ])
      assert.deepEqual(res.value.page.enumeratedPaths, [{ id: 'intro' }, { id: 'advanced' }])
    })

    it('executes async paths block returning valid params', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/posts/[id].html',
          dirname: '/pages/posts',
          filename: '[id].html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              async paths () {
                await Promise.resolve()
                return [{ id: '1' }, { id: '2' }]
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.deepEqual(res.value.page.enumeratedPaths, [{ id: '1' }, { id: '2' }])
    })

    it('handles paths returning []', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/posts/[id].html',
          dirname: '/pages/posts',
          filename: '[id].html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              paths () { return [] }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.deepEqual(res.value.page.enumeratedPaths, [])
    })

    it('passes { app } into paths block and allows reading app options', async () => {
      const mockApp = createMockApp({ customProp: 'hello' })

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/posts/[id].html',
          dirname: '/pages/posts',
          filename: '[id].html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              paths ({ app }) {
                return [{ id: app.customProp }]
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.deepEqual(res.value.page.enumeratedPaths, [{ id: 'hello' }])
    })

    it('marks page as failed and emits error when paths throws', async () => {
      const mockApp = createMockApp()
      let handledError = null

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: (data) => {
          handledError = data
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/posts/[id].html',
          dirname: '/pages/posts',
          filename: '[id].html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              paths () {
                throw new Error('Database connection failed')
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.strictEqual(res.value.page.failed, true)
      assert.strictEqual(res.value.page.enumeratedPaths.length, 0)
      assert.ok(res.value.page.error.message.includes('Database connection failed'))
      assert.strictEqual(res.value.page.error.filePath, '/pages/posts/[id].html')
      assert.ok(handledError)
      assert.strictEqual(handledError.level, 'ERR')
    })

    it('marks page as failed when paths block returns duplicate param sets', async () => {
      const mockApp = createMockApp()
      let handledError = null

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: (data) => {
          handledError = data
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/posts/[id].html',
          dirname: '/pages/posts',
          filename: '[id].html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              paths () {
                return [{ id: 'intro' }, { id: 'intro' }]
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.strictEqual(res.value.page.failed, true)
      assert.strictEqual(res.value.page.enumeratedPaths.length, 0)
      assert.ok(res.value.page.error.message.includes('Duplicate path in'))
      assert.ok(handledError)
      assert.strictEqual(handledError.level, 'ERR')
    })

    it('defaults static pages (no paths block) to page.enumeratedPaths = []', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/about.html',
          dirname: '/pages',
          filename: 'about.html'
        },
        content: '<h1>About</h1>',
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.strictEqual(res.value.page.routePattern, '/about')
      assert.deepStrictEqual(res.value.page.routeParams, [])
      assert.deepStrictEqual(res.value.page.routeSegments, [
        {
          type: 'static',
          value: 'about'
        }
      ])
      assert.deepStrictEqual(res.value.page.enumeratedPaths, [])
    })

    it('parses catch-all [...slug] segment and evaluates paths block without emitting W601', async () => {
      const mockApp = createMockApp()
      const emittedWarnings = []

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: (data) => {
          if (data.level === 'WARN') {
            emittedWarnings.push(data)
          }
        },
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/docs/[...slug].html',
          dirname: '/pages/docs',
          filename: '[...slug].html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              paths () {
                return [{ slug: 'getting-started' }]
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.strictEqual(emittedWarnings.length, 0)
      assert.strictEqual(res.value.page.routePattern, '/docs/:slug*')
      assert.deepEqual(res.value.page.routeParams, ['slug'])
      assert.deepEqual(res.value.page.routeSegments, [
        {
          type: 'static',
          value: 'docs'
        },
        {
          type: 'catchall',
          value: 'slug'
        }
      ])
      assert.deepEqual(res.value.page.enumeratedPaths, [{ slug: 'getting-started' }])
    })
  })
})
