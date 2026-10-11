import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite, definePlugin } from '#lib'

let TEST_DIR
let COMPONENTS_DIR
let PAGES_DIR
let OUTPUT_DIR

describe('Server-side Route Context in Page Blocks', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-page-route-ctx-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    PAGES_DIR = join(TEST_DIR, 'pages')
    OUTPUT_DIR = join(TEST_DIR, 'dist')

    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })

    await writeFile(
      join(COMPONENTS_DIR, 'consume-route-from-page.html'),
      `<template id="consume-route-from-page">
        <p ref="output">{{ currentPath }}</p>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          consume: {
            currentPath: 'coralite:route'
          }
        })
      </script>`
    )
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('page getters receives route with correct shape for a static page and bakes output into rendered HTML', async () => {
    await writeFile(
      join(PAGES_DIR, 'about.html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          server: () => ({ name: 'Alice' }),
          getters: {
            greeting: ({ state, route }) => \`\${state.name} at \${route.path} (dynamic:\${route.dynamic})\`
          }
        })
      </script>
      <!DOCTYPE html>
      <html>
      <head><title>About</title></head>
      <body>
        <h1>{{ greeting }}</h1>
      </body>
      </html>`
    )

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)

    const html = results[0].content
    assert.ok(html.includes('<h1>Alice at /about.html (dynamic:false)</h1>'), 'Page getter output depending on route must be baked into HTML')
  })

  it('page getters receives route with correct shape for a dynamic page per enumerated path', async () => {
    await mkdir(join(PAGES_DIR, 'posts'), { recursive: true })
    await writeFile(
      join(PAGES_DIR, 'posts', '[id].html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          paths () {
            return [{ id: 'intro' }]
          },
          getters: {
            postInfo: ({ route }) => \`Post \${route.params.id} at \${route.path} (pattern:\${route.pattern}, dynamic:\${route.dynamic})\`
          }
        })
      </script>
      <!DOCTYPE html>
      <html>
      <head><title>Post</title></head>
      <body>
        <h2>{{ postInfo }}</h2>
      </body>
      </html>`
    )

    const routePlugin = definePlugin({
      name: 'test-dynamic-route-plugin',
      server: {
        onBeforePageRender ({ page }) {
          if (page.enumeratedPaths && page.enumeratedPaths.length > 0) {
            page.route = {
              path: '/posts/intro.html',
              pattern: '/posts/[id].html',
              params: { id: 'intro' },
              dynamic: true
            }
          }
        }
      }
    })

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false,
      plugins: [routePlugin()]
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)

    const html = results[0].content
    assert.ok(html.includes('<h2>Post intro at /posts/intro.html (pattern:/posts/[id].html, dynamic:true)</h2>'))
  })

  it('page provide receives route and descendant components consuming page-provided context read route values correctly', async () => {
    await writeFile(
      join(PAGES_DIR, 'provided.html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          provide: {
            'coralite:route': ({ route }) => route.path
          }
        })
      </script>
      <!DOCTYPE html>
      <html>
      <head><title>Provide Test</title></head>
      <body>
        <consume-route-from-page></consume-route-from-page>
      </body>
      </html>`
    )

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)

    const html = results[0].content
    assert.ok(html.includes('/provided.html'), 'Consumed context value from page provide must be rendered into component output')
  })

  it('negative test: page style block receives state directly and does not receive context object', async () => {
    await writeFile(
      join(PAGES_DIR, 'style-test.html'),
      `<!DOCTYPE html>
      <html>
      <head>
        <title>Style Test</title>
        <script type="module">
          import { definePage } from 'coralite'
          export default definePage({
            server: () => ({ themeColor: 'blue' }),
            style: {
              '--theme': (state) => {
                const isDirectState = state.state === undefined
                return isDirectState ? state.themeColor : 'wrong'
              }
            }
          })
        </script>
      </head>
      <body>
        <h1>Style Test</h1>
      </body>
      </html>`
    )

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await coralite.build()
    assert.equal(results.length, 1)

    const html = results[0].content
    assert.ok(html.includes('style="--theme: blue;') || html.includes('style="--theme:blue;'), 'Style getter should evaluate with state directly on html tag')
    assert.ok(!html.includes('--theme: wrong') && !html.includes('--theme:wrong'), 'Style getter must not receive context wrapper')
  })
})
