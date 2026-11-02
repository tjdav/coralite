
import '../../../setup.js'
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createTestProject } from '../../../utils/project.js'
import { definePlugin } from '../../../../../lib/server/plugin/define.js'
import { setupPageRuntime } from '../../../../../lib/client/page-runtime.js'

describe('Page Plugin Context Injection & Getter Invariants', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('injects server plugin context into definePage server() block', async () => {
    const demoPlugin = definePlugin({
      name: 'demo',
      server: {
        context: () => () => ({
          greeting: 'Hello from demo plugin'
        })
      }
    })

    await project.writePage('index.html', `
<!DOCTYPE html>
<html>
  <head><title>{{ title }}</title></head>
  <body>
    <h1>{{ title }}</h1>
    <script type="module">
      import { definePage } from 'coralite'

      export default definePage({
        async server ({ demo, route }) {
          return {
            title: demo ? demo.greeting : 'missing'
          }
        }
      })
    </script>
  </body>
</html>
`)

    const app = await project.createCoralite({
      plugins: [demoPlugin],
      mode: 'development'
    })

    const results = await app.build(project.pagesDir + '/index.html')
    assert.strictEqual(results.length, 1)
    assert.ok(results[0].content.includes('Hello from demo plugin'), 'Plugin context was injected into page server()')
  })

  it('guarantees framework keys take precedence over colliding plugin names in page server()', async () => {
    const warnings = []
    const collidingPlugin = definePlugin({
      name: 'route',
      server: {
        context: () => () => 'COLLIDING_PLUGIN_VALUE'
      }
    })

    await project.writePage('collision.html', `
<!DOCTYPE html>
<html>
  <body>
    <span>{{ path }}</span>
    <script type="module">
      import { definePage } from 'coralite'

      export default definePage({
        async server ({ route }) {
          return {
            path: typeof route === 'object' && route.path !== undefined ? route.path : 'BROKEN'
          }
        }
      })
    </script>
  </body>
</html>
`)

    const app = await project.createCoralite({
      plugins: [collidingPlugin],
      mode: 'development',
      onError: ({ level, message }) => {
        if (level === 'WARN') {
          warnings.push(message)
        }
      }
    })

    const results = await app.build(project.pagesDir + '/collision.html')
    assert.strictEqual(results.length, 1)
    assert.ok(!results[0].content.includes('COLLIDING_PLUGIN_VALUE'))
    assert.ok(warnings.some(w => w.includes('collides with reserved page server context key "route"')))
  })

  it('emits warning when isomorphic getters attempt to access registered plugin names in dev mode', async () => {
    const warnings = []
    const i18nPlugin = definePlugin({
      name: '$t',
      server: {
        context: () => () => (key) => `translated_${key}`
      }
    })

    await project.writePage('getters-warning.html', `
<!DOCTYPE html>
<html>
  <body>
    <h1>{{ label }}</h1>
    <script type="module">
      import { definePage } from 'coralite'

      export default definePage({
        server () {
          return { key: 'home' }
        },
        getters: {
          label ({ state, $t }) {
            return $t ? $t(state.key) : 'fallback'
          }
        }
      })
    </script>
  </body>
</html>
`)

    const app = await project.createCoralite({
      plugins: [i18nPlugin],
      mode: 'development',
      onError: ({ level, message }) => {
        if (level === 'WARN') {
          warnings.push(message)
        }
      }
    })

    const results = await app.build(project.pagesDir + '/getters-warning.html')
    assert.strictEqual(results.length, 1)
    assert.ok(results[0].content.includes('fallback'), 'Getter received undefined for plugin')
    assert.ok(warnings.some(w => w.includes('Plugin "$t" cannot be accessed directly in isomorphic getters')), 'Emitted warning explaining getter isomorphism invariant')
  })

  it('emits warning when component isomorphic getters attempt to access registered plugin names in dev mode', async () => {
    const warnings = []
    const dbPlugin = definePlugin({
      name: 'db',
      server: {
        context: () => () => ({ query: () => [] })
      }
    })

    await project.writeComponent('user-item.html', `
<template id="user-item">
  <div>{{ fullName }}</div>
</template>
<script type="module">
  export const getters = {
    fullName ({ db }) {
      return db ? 'invalid' : 'safe'
    }
  }
</script>
`)

    await project.writePage('comp-page.html', `
<!DOCTYPE html>
<html>
  <body>
    <user-item></user-item>
  </body>
</html>
`)

    const app = await project.createCoralite({
      plugins: [dbPlugin],
      mode: 'development',
      onError: ({ level, message }) => {
        if (level === 'WARN') {
          warnings.push(message)
        }
      }
    })

    const results = await app.build(project.pagesDir + '/comp-page.html')
    assert.strictEqual(results.length, 1)
    assert.ok(results[0].content.includes('safe'))
    assert.ok(warnings.some(w => w.includes('Plugin "db" cannot be accessed directly in isomorphic getters')))
  })

  it('injects client plugin context into page client() handler in setupPageRuntime', async () => {
    let receivedPlugin = null
    const mockGetClientContext = async (ctx) => ({
      myClientPlugin: {
        track: (name) => `tracked_${name}_${ctx.route.path}`
      }
    })

    await setupPageRuntime({
      route: { path: '/about' },
      client ({ myClientPlugin, route }) {
        receivedPlugin = myClientPlugin ? myClientPlugin.track(route.path) : null
      }
    }, mockGetClientContext)

    assert.strictEqual(receivedPlugin, 'tracked_/about_/about')
  })

  it('respects testing plugin mocks in page server()', async () => {
    const plugin = definePlugin({
      name: 'api',
      server: {
        context: () => () => ({
          getData: () => 'real_data'
        })
      }
    })

    await project.writePage('mock-test.html', `
<!DOCTYPE html>
<html>
  <body>
    <span>{{ content }}</span>
    <script type="module">
      import { definePage } from 'coralite'

      export default definePage({
        async server ({ api }) {
          return {
            content: api ? api.getData() : 'missing'
          }
        }
      })
    </script>
  </body>
</html>
`)

    const app = await project.createCoralite({
      plugins: [plugin],
      mode: 'testing',
      testing: {
        mocks: {
          plugins: {
            api: {
              server: {
                context: {
                  getData: () => 'mocked_data'
                }
              }
            }
          }
        }
      }
    })

    const results = await app.build(project.pagesDir + '/mock-test.html')
    assert.strictEqual(results.length, 1)
    assert.ok(results[0].content.includes('mocked_data'), 'Page server received mocked plugin method')
  })
})
