import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createPageHandlers } from '../../../../../lib/server/collection/handlers.js'
import { evaluate } from '../../../../../lib/server/compiler.js'
import { buildRoute } from '../../../../../lib/server/page/route.js'

describe('Page server() execution per enumerated path', () => {
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
    _refreshDependencyGraph: () => {},
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

  const triggerHook = async (_name, ctx) => ctx

  describe('buildRoute', () => {
    it('constructs route object for dynamic pages', () => {
      const route = buildRoute('posts/[id].html', { id: 'intro' })
      assert.deepStrictEqual(route, {
        path: '/posts/intro',
        pattern: '/posts/:id',
        params: { id: 'intro' },
        dynamic: true
      })
    })

    it('constructs route object for static pages', () => {
      const route = buildRoute('about.html', {})
      assert.deepStrictEqual(route, {
        path: '/about',
        pattern: '/about',
        params: {},
        dynamic: false
      })
    })

    it('handles index files correctly', () => {
      const routeIndex = buildRoute('index.html', {})
      assert.deepStrictEqual(routeIndex, {
        path: '/',
        pattern: '/',
        params: {},
        dynamic: false
      })

      const routeSubIndex = buildRoute('posts/[id]/index.html', { id: 'hello' })
      assert.deepStrictEqual(routeSubIndex, {
        path: '/posts/hello',
        pattern: '/posts/:id',
        params: { id: 'hello' },
        dynamic: true
      })
    })
  })

  describe('server block execution in collection handlers', () => {
    it('executes synchronous server block and attaches state and route', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {},
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
            const posts = [
              { id: 'intro', title: 'Intro' },
              { id: 'advanced', title: 'Advanced' }
            ]
            export default definePage({
              paths () {
                return [{ id: 'intro' }, { id: 'advanced' }]
              },
              server ({ route }) {
                const post = posts.find(p => p.id === route.params.id)
                return { title: post.title }
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      const enumerated = res.value.page.enumeratedPaths
      assert.strictEqual(enumerated.length, 2)

      assert.strictEqual(enumerated[0].params.id, 'intro')
      assert.strictEqual(enumerated[0].route.path, '/posts/intro')
      assert.strictEqual(enumerated[0].route.pattern, '/posts/:id')
      assert.strictEqual(enumerated[0].route.dynamic, true)
      assert.deepEqual(enumerated[0].state, { title: 'Intro' })

      assert.strictEqual(enumerated[1].params.id, 'advanced')
      assert.strictEqual(enumerated[1].route.path, '/posts/advanced')
      assert.deepEqual(enumerated[1].state, { title: 'Advanced' })
    })

    it('executes async server block returning valid state', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {},
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
                return [{ id: '1' }]
              },
              async server ({ route }) {
                await Promise.resolve()
                return { id: route.params.id, asyncVal: 'loaded' }
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      const enumerated = res.value.page.enumeratedPaths
      assert.strictEqual(enumerated.length, 1)
      assert.deepEqual(enumerated[0].state, { id: '1', asyncVal: 'loaded' })
    })

    it('executes server block for a static page with no paths block', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {},
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/about.html',
          dirname: '/pages',
          filename: 'about.html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              server ({ route }) {
                return {
                  title: 'About Us',
                  path: route.path,
                  dynamic: route.dynamic
                }
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      const enumerated = res.value.page.enumeratedPaths
      assert.strictEqual(enumerated.length, 1)
      assert.strictEqual(enumerated[0].route.path, '/about')
      assert.strictEqual(enumerated[0].route.pattern, '/about')
      assert.strictEqual(enumerated[0].route.dynamic, false)
      assert.deepStrictEqual(enumerated[0].route.params, {})
      assert.deepEqual(enumerated[0].state, {
        title: 'About Us',
        path: '/about',
        dynamic: false
      })
    })

    it('passes { route, app, session, signal } into server block', async () => {
      const mockApp = createMockApp({ customProp: 'hello-app' })

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {},
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/about.html',
          dirname: '/pages',
          filename: 'about.html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              server ({ route, app, session, signal }) {
                return {
                  hasRoute: Boolean(route),
                  hasApp: Boolean(app && app.customProp === 'hello-app'),
                  hasSession: Boolean(session),
                  hasSignal: Boolean(signal && typeof signal.aborted === 'boolean')
                }
              }
            })
          </script>
        `,
        state: {
          session: { customSession: true },
          signal: new AbortController().signal
        }
      }

      const res = await handlers.onPageSet(data)
      const enumerated = res.value.page.enumeratedPaths
      assert.deepEqual(enumerated[0].state, {
        hasRoute: true,
        hasApp: true,
        hasSession: true,
        hasSignal: true
      })
    })

    it('passes plugin context into server block via ...pluginContext', async () => {
      const mockApp = createMockApp()
      mockApp.source.plugins = {
        myPlugin: () => ({
          getSecret: () => 'plugin-secret'
        })
      }

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {},
        evaluate
      })

      const data = {
        type: 'page',
        path: {
          pathname: '/pages/about.html',
          dirname: '/pages',
          filename: 'about.html'
        },
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              server ({ myPlugin }) {
                return {
                  secret: myPlugin ? myPlugin.getSecret() : null
                }
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      const enumerated = res.value.page.enumeratedPaths
      assert.deepEqual(enumerated[0].state, { secret: 'plugin-secret' })
    })

    it('produces empty state ({}) per path when page has no server block', async () => {
      const mockApp = createMockApp()
      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: () => {},
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
                return [{ id: '1' }, { id: '2' }]
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      const enumerated = res.value.page.enumeratedPaths
      assert.strictEqual(enumerated.length, 2)
      assert.deepEqual(enumerated[0].state, {})
      assert.deepEqual(enumerated[1].state, {})
    })

    it('throws CORALITE-E406 if server block returns a non-object', async () => {
      const mockApp = createMockApp()
      let handledError = null

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: (err) => {
          handledError = err
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
        content: `
          <script type="module">
            import { definePage } from 'coralite'
            export default definePage({
              server () {
                return 'invalid string'
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.strictEqual(res.value.page.failed, true)
      assert.strictEqual(res.value.page.error.code, 'CORALITE-E406')
      assert.strictEqual(res.value.page.error.filePath, '/pages/about.html')
      assert.ok(handledError)
      assert.strictEqual(handledError.level, 'ERR')
    })

    it('allows remaining paths to execute independently if server throws for one path', async () => {
      const mockApp = createMockApp()
      const handledErrors = []

      const handlers = createPageHandlers({
        app: mockApp,
        triggerHook,
        handleError: (err) => {
          handledErrors.push(err)
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
                return [{ id: 'good' }, { id: 'bad' }, { id: 'also-good' }]
              },
              server ({ route }) {
                if (route.params.id === 'bad') {
                  throw new Error('Failed to load bad id')
                }
                return { id: route.params.id, status: 'ok' }
              }
            })
          </script>
        `,
        state: {}
      }

      const res = await handlers.onPageSet(data)
      assert.strictEqual(res.value.page.failed, true)
      const enumerated = res.value.page.enumeratedPaths
      assert.strictEqual(enumerated.length, 3)

      assert.deepEqual(enumerated[0].state, { id: 'good', status: 'ok' })
      assert.strictEqual(enumerated[0].failed, undefined)

      assert.strictEqual(enumerated[1].failed, true)
      assert.deepEqual(enumerated[1].state, {})
      assert.ok(enumerated[1].error.message.includes('Failed to load bad id'))

      assert.deepEqual(enumerated[2].state, { id: 'also-good', status: 'ok' })
      assert.strictEqual(enumerated[2].failed, undefined)

      assert.strictEqual(handledErrors.length, 1)
      assert.strictEqual(handledErrors[0].level, 'ERR')
    })
  })
})
