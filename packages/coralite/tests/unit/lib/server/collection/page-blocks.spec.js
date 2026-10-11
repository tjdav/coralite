import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '../../../../../lib/index.js'
import { validatePageSource } from '../../../../../lib/server/page/validator.js'

describe('Page Blocks - Build-Time Execution (getters, style, provide, client)', () => {
  let projectDir
  let app

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'coralite-page-blocks-test-'))
    const pagesDir = join(projectDir, 'pages')
    const componentsDir = join(projectDir, 'components')
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    await writeFile(join(pagesDir, 'with-getters.html'), `
      <script type="module">
        import { definePage } from 'coralite'

        export default definePage({
          server: () => ({ first: 'Alice', last: 'Smith' }),
          getters: {
            fullName: ({ state }) => \`\${state.first} \${state.last}\`,
            greeting: ({ state, route }) =>
              route.path === '/' ? 'Welcome' : \`Welcome back to \${route.path}\`
          }
        })
      </script>
      <h1>{{ greeting }}</h1>
      <p>{{ fullName }}</p>
    `)

    await writeFile(join(pagesDir, 'with-style.html'), `
      <!DOCTYPE html>
      <html>
      <head>
        <script type="module">
          import { definePage } from 'coralite'

          export default definePage({
            server: () => ({ theme: 'dark' }),
            style: {
              '--page-theme': (state) => state.theme === 'dark' ? '#1a1a1a' : '#ffffff',
              '--page-accent': (state) => state.theme === 'dark' ? '#60a5fa' : '#2563eb'
            }
          })
        </script>
      </head>
      <body>
        <h1>Style Page</h1>
      </body>
      </html>
    `)

    await writeFile(join(pagesDir, 'with-provide.html'), `
      <script type="module">
        import { definePage, createContext } from 'coralite'

        export const themeContext = createContext('coralite:theme')

        export default definePage({
          server: () => ({ theme: { mode: 'dark', accent: '#60a5fa' } }),
          provide: {
            [themeContext]: ({ state }) => state.theme
          }
        })
      </script>
      <consume-page-provide></consume-page-provide>
    `)

    await writeFile(join(componentsDir, 'consume-page-provide.html'), `
      <template id="consume-page-provide">
        <p data-testid="theme-mode">{{ theme.mode }}</p>
      </template>

      <script type="module">
        import { defineComponent, createContext } from 'coralite'

        const themeContext = createContext('coralite:theme')

        export default defineComponent({
          consume: {
            theme: themeContext
          }
        })
      </script>
    `)

    app = await createCoralite({
      projectRoot: projectDir,
      output: join(projectDir, 'dist'),
      pages: pagesDir,
      components: componentsDir,
      mode: 'production'
    })
  })

  afterEach(async () => {
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  test('Page getters evaluate at build time and resolved values appear in rendered HTML', async () => {
    const results = await app.build(join(projectDir, 'pages/with-getters.html'))
    assert.equal(results.length, 1)
    const content = results[0].content
    assert.ok(content.includes('Welcome back to /with-getters.html'), 'Greeting token resolved with route')
    assert.ok(content.includes('Alice Smith'), 'FullName getter token resolved with state')
  })

  test('Page getters receive { state, route, root, refs, signal }', async () => {
    const getterPagePath = join(projectDir, 'pages/getter-ctx.html')
    await writeFile(getterPagePath, `
      <script type="module">
        import { definePage } from 'coralite'

        export default definePage({
          server: () => ({ val: 42 }),
          getters: {
            check: (ctx) => {
              return Boolean(ctx.state && ctx.route && ctx.root && ctx.refs && ctx.signal)
            }
          }
        })
      </script>
      <p>{{ check }}</p>
    `)

    const results = await app.build(getterPagePath)
    assert.ok(results[0].content.includes('true'))
  })

  test('Non-destructured page getter throws CORALITE-E105 during script validation', async () => {
    const badSource = `
      <script type="module">
        import { definePage } from 'coralite'

        export default definePage({
          getters: {
            bad: (state) => state.first
          }
        })
      </script>
    `

    const validation = validatePageSource(badSource, { filePath: 'bad-getter.html' })
    const e105 = validation.diagnostics.find(d => d.code === 'CORALITE-E105')
    assert.ok(e105, 'CORALITE-E105 diagnostic emitted for non-destructured page getter parameter')
  })

  test('Page style applies CSS custom properties to <html> tag in rendered output', async () => {
    const results = await app.build(join(projectDir, 'pages/with-style.html'))
    const content = results[0].content
    assert.ok(content.includes('--page-theme'), 'Style property --page-theme present')
    assert.ok(content.includes('#1a1a1a'), 'Style value #1a1a1a present')
  })

  test('Async page style function throws CORALITE-E303 during validation or build', async () => {
    const asyncStyleSource = `
      <script type="module">
        import { definePage } from 'coralite'

        export default definePage({
          style: {
            '--color': async () => '#000000'
          }
        })
      </script>
    `

    const validation = validatePageSource(asyncStyleSource, { filePath: 'async-style.html' })
    const e303 = validation.diagnostics.find(d => d.code === 'CORALITE-E303')
    assert.ok(e303, 'CORALITE-E303 diagnostic emitted for async page style function')
  })

  test('Page provide makes values available to descendant components via consume', async () => {
    const results = await app.build(join(projectDir, 'pages/with-provide.html'))
    const content = results[0].content
    assert.ok(content.includes('dark'), 'Descendant component consumed page-provided theme context')
  })

  test('Page with client block serializes and injects window.__coralite_page_config__ into rendered output', async () => {
    const clientPagePath = join(projectDir, 'pages/with-client.html')
    await writeFile(clientPagePath, `
      <script type="module">
        import { definePage } from 'coralite'

        export default definePage({
          server: () => ({ initialCount: 10 }),
          client: async ({ state }) => {
            document.documentElement.setAttribute('data-client-ran', 'true')
          }
        })
      </script>
      <h1>Client Page</h1>
    `)

    const results = await app.build(clientPagePath)
    assert.equal(results.length, 1)
    const content = results[0].content
    assert.ok(content.includes('window.__coralite_page_config__'), 'Page config is injected into client runtime')
    assert.ok(content.includes('initialCount'), 'Page state is included in injected page config')
  })
})
