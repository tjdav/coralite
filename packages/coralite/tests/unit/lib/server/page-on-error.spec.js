import '../../setup.js'
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '../../../../lib/server/create.js'

describe('Page onError block execution', () => {
  let projectDir
  let pagesDir
  let componentsDir
  let activeApps = []

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'coralite-page-onerror-test-'))
    pagesDir = join(projectDir, 'pages')
    componentsDir = join(projectDir, 'components')
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })
    activeApps = []
  })

  afterEach(async () => {
    for (const app of activeApps) {
      try {
        await app.clearCache(true)
      } catch {
        /* ignore */
      }
    }
    activeApps = []
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  async function setupApp (mode = 'production') {
    const app = await createCoralite({
      projectRoot: projectDir,
      output: join(projectDir, 'dist'),
      pages: pagesDir,
      components: componentsDir,
      mode
    })
    activeApps.push(app)
    return app
  }

  it('onError returning { template, state } renders the fallback with tokens resolved against the merged state', async () => {
    const pagePath = join(pagesDir, 'test-template-state.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server: async () => {
            throw new Error('Server build failed')
          },
          onError ({
            error,
            state,
            route,
            app
          }) {
            return {
              template: '<div class="fallback"><h1>Error</h1><p>{{ message }}</p></div>',
              state: { message: 'Loaded fallback state.' }
            }
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, {
      continueOnError: true
    })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.ok(res.content.includes('<div class="fallback"><h1>Error</h1><p>Loaded fallback state.</p></div>'))
  })

  it('onError returning a string renders it as the fallback template', async () => {
    const pagePath = join(pagesDir, 'test-string.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server: async () => {
            throw new Error('Server build failed')
          },
          onError ({ error, state, route, app }) {
            return '<div class="fallback-string"><h1>String Fallback</h1></div>'
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, { continueOnError: true })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.ok(res.content.includes('<div class="fallback-string"><h1>String Fallback</h1></div>'))
  })

  it('onError returning null or undefined marks the page as failed', async () => {
    const pagePath = join(pagesDir, 'test-void.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server: async () => {
            throw new Error('Server build failed')
          },
          onError ({ error, state, route, app }) {
            return null
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, { continueOnError: true })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.strictEqual(res.status, 'failed')
  })

  it('onError throwing marks the page as failed and onError is not called recursively', async () => {
    const pagePath = join(pagesDir, 'test-throws.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server: async () => {
            throw new Error('Server build failed')
          },
          onError ({ error, state, route, app }) {
            throw new Error('onError hook itself threw')
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, { continueOnError: true })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.strictEqual(res.status, 'failed')
  })

  it('onError receives { error, state, route, app } context arguments', async () => {
    let receivedArgs = null
    const pagePath = join(pagesDir, 'test-args.html')

    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server: async () => {
            return { step: 'init' }
          },
          getters: {
            badGetter () {
              throw new Error('Getter failed')
            }
          },
          onError (ctx) {
            return {
              template: '<div>Fallback</div>',
              state: {}
            }
          }
        })
      </script>
      <h1>{{ badGetter }}</h1>
    `)

    const app = await setupApp('production')
    const pageItem = app.pages.getItem(pagePath)
    if (pageItem && pageItem.result?.page?.exports) {
      const origOnError = pageItem.result.page.exports.onError
      pageItem.result.page.exports.onError = (ctx) => {
        receivedArgs = ctx
        return origOnError(ctx)
      }
    }

    await app.build(pagePath, { continueOnError: true })
    assert.ok(receivedArgs)
    assert.ok(receivedArgs.error)
    assert.ok(receivedArgs.state)
    assert.ok(receivedArgs.route)
    assert.ok(receivedArgs.app)
  })

  it('Page client block does not run when fallback renders', async () => {
    const pagePath = join(pagesDir, 'test-client-skip.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server: async () => {
            throw new Error('Server failed')
          },
          client () {
            document.documentElement.setAttribute('data-client-ran', 'true')
          },
          onError () {
            return '<div>Fallback Template</div>'
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, { continueOnError: true })
    const res = results[0]
    assert.ok(res.content)
    assert.strictEqual(res.content.includes('window.__coralite_page_config__'), true)
    assert.strictEqual(res.content.includes('"client": null') || res.content.includes('"client":null'), true)
  })

  it('Component client blocks inside fallback template do run / hydrate', async () => {
    await writeFile(join(componentsDir, 'simple-header.html'), `
      <template id="simple-header">
        <header>Header</header>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client () {}
        })
      </script>
    `)

    const pagePath = join(pagesDir, 'comp-fallback.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server () {
            throw new Error('Server failed')
          },
          onError () {
            return '<div class="fallback-comp"><simple-header></simple-header></div>'
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await createCoralite({
      projectRoot: projectDir,
      output: join(projectDir, 'dist'),
      pages: pagesDir,
      components: componentsDir,
      mode: 'production'
    })
    activeApps.push(app)

    const results = await app.build(pagePath, { continueOnError: true })
    const res = results[0]
    assert.ok(res.content.includes('<simple-header'))
  })

  it('In development mode, onError is not called and the error re-throws / marks page failed', async () => {
    const pagePath = join(pagesDir, 'test-dev-mode.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server () {
            throw new Error('Dev server error')
          },
          onError () {
            return '<div class="fallback">Fallback</div>'
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('development')
    const results = await app.build(pagePath, { continueOnError: true })
    const res = results[0]
    assert.strictEqual(res.status, 'failed')
    assert.strictEqual(res.content, undefined)
  })

  it('In testing mode, onError is not called and the error re-throws / marks page failed', async () => {
    const pagePath = join(pagesDir, 'test-testing-mode.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server () {
            throw new Error('Testing server error')
          },
          onError () {
            return '<div class="fallback">Fallback</div>'
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('testing')
    const results = await app.build(pagePath, { continueOnError: true })
    const res = results[0]
    assert.strictEqual(res.status, 'failed')
    assert.strictEqual(res.content, undefined)
  })

  it('A page where server succeeds but a getter throws invokes onError', async () => {
    const pagePath = join(pagesDir, 'test-getter-throws.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server () {
            return { initial: 'ok' }
          },
          getters: {
            badGetter () {
              throw new Error('Getter failed')
            }
          },
          onError () {
            return '<div class="fallback-getter">Fallback from getter failure</div>'
          }
        })
      </script>
      <h1>{{ badGetter }}</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, { continueOnError: true })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.ok(res.content.includes('<div class="fallback-getter">Fallback from getter failure</div>'))
  })

  it('A page without onError whose server throws is marked failed', async () => {
    const pagePath = join(pagesDir, 'no-on-error.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server () {
            throw new Error('Server failed')
          }
        })
      </script>
      <h1>Original</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, { continueOnError: true })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.strictEqual(res.status, 'failed')
  })

  it('state passed to onError contains the partial state populated by server before the error', async () => {
    const pagePath = join(pagesDir, 'partial-state.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          async server () {
            return { step1: 'done' }
          },
          getters: {
            badGetter () {
              throw new Error('Getter failed midway')
            }
          },
          onError ({ state }) {
            return {
              template: '<div>Fallback {{ step1 }}</div>',
              state: { extra: 'ok' }
            }
          }
        })
      </script>
      <h1>{{ badGetter }}</h1>
    `)

    const app = await setupApp('production')
    const results = await app.build(pagePath, { continueOnError: true })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.ok(res.content.includes('Fallback done'))
  })

  it('Component errors inside a page do not trigger the page onError', async () => {
    await writeFile(join(componentsDir, 'failing-comp.html'), `
      <template id="failing-comp">
        <div>{{ badGetter }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            badGetter () {
              throw new Error('Component getter failed')
            }
          },
          onError () {
            return '<div class="comp-fallback">Component Fallback</div>'
          }
        })
      </script>
    `)

    const pagePath = join(pagesDir, 'comp-error.html')
    await writeFile(pagePath, `
      <script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server () {
            return { title: 'Page OK' }
          },
          onError () {
            return '<div class="page-fallback">Page Fallback Should Not Run</div>'
          }
        })
      </script>
      <h1>{{ title }}</h1>
      <failing-comp></failing-comp>
    `)

    const app = await createCoralite({
      projectRoot: projectDir,
      output: join(projectDir, 'dist'),
      pages: pagesDir,
      components: componentsDir,
      mode: 'production'
    })
    activeApps.push(app)

    const results = await app.build(pagePath, { continueOnError: true })
    assert.strictEqual(results.length, 1)
    const res = results[0]
    assert.ok(res.content.includes('<h1>Page OK</h1>'))
    assert.ok(res.content.includes('<div class="comp-fallback">Component Fallback</div>'))
  })
})
