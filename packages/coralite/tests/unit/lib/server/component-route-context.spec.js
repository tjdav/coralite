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

describe('Server-side Route Context in Component Blocks', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-comp-route-ctx-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    PAGES_DIR = join(TEST_DIR, 'pages')
    OUTPUT_DIR = join(TEST_DIR, 'dist')

    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('component server receives route matching the enclosing page', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'server-route-comp.html'),
      `<template id="server-route-comp">
        <p id="route-p">{{ postId }}</p>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server: ({ route }) => {
            return { postId: route?.params?.id || route?.path || 'none' }
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'page-a.html'),
      `<!DOCTYPE html>
      <html>
      <body>
        <server-route-comp></server-route-comp>
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
    assert.ok(html.includes('/page-a.html'), 'Component server block must receive enclosing page route')
  })

  it('component getters receives route with correct shape for a static page and bakes output into rendered HTML', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'getter-route-comp.html'),
      `<template id="getter-route-comp">
        <span class="path-span">{{ currentPath }}</span>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            currentPath: ({ route }) => \`Path: \${route.path} (dynamic:\${route.dynamic})\`
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'static-page.html'),
      `<!DOCTYPE html>
      <html>
      <body>
        <getter-route-comp></getter-route-comp>
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
    assert.ok(html.includes('Path: /static-page.html (dynamic:false)'), 'Component getter output depending on route must be baked into HTML')
  })

  it('component getters receives route with correct shape for a dynamic page', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'getter-dynamic-route-comp.html'),
      `<template id="getter-dynamic-route-comp">
        <span class="dyn-span">{{ paramInfo }}</span>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            paramInfo: ({ route }) => \`ID: \${route.params.id} at \${route.path} (pattern:\${route.pattern})\`
          }
        })
      </script>`
    )

    await mkdir(join(PAGES_DIR, 'items'), { recursive: true })
    await writeFile(
      join(PAGES_DIR, 'items', '[id].html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          paths () {
            return [{ id: '99' }]
          }
        })
      </script>
      <!DOCTYPE html>
      <html>
      <body>
        <getter-dynamic-route-comp></getter-dynamic-route-comp>
      </body>
      </html>`
    )

    const routePlugin = definePlugin({
      name: 'test-comp-dynamic-route-plugin',
      server: {
        onBeforePageRender ({ page }) {
          if (page.enumeratedPaths && page.enumeratedPaths.length > 0) {
            page.route = {
              path: '/items/99.html',
              pattern: '/items/[id].html',
              params: { id: '99' },
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
    assert.ok(html.includes('ID: 99 at /items/99.html (pattern:/items/[id].html)'), 'Component getter must receive dynamic route params and pattern')
  })

  it('component slots receives route', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'slot-route-comp.html'),
      `<template id="slot-route-comp">
        <div class="slot-wrap">
          <slot></slot>
        </div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          slots: {
            default (nodes, { route }) {
              return nodes.map(n => {
                if (n.attribs) {
                  n.attribs['data-slot-route'] = route.path
                }
                return n
              })
            }
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'slot-page.html'),
      `<!DOCTYPE html>
      <html>
      <body>
        <slot-route-comp>
          <p id="target">Slotted</p>
        </slot-route-comp>
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
    assert.ok(html.includes('data-slot-route="/slot-page.html"'), 'Component slots context must receive route')
  })

  it('component provide receives route and descendant consumes context', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'comp-provider.html'),
      `<template id="comp-provider">
        <div class="prov">
          <slot></slot>
        </div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          provide: {
            'comp-route': ({ route }) => route.path
          }
        })
      </script>`
    )

    await writeFile(
      join(COMPONENTS_DIR, 'comp-consumer.html'),
      `<template id="comp-consumer">
        <span id="consumed">{{ currentRoute }}</span>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          consume: {
            currentRoute: 'comp-route'
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'provide-page.html'),
      `<!DOCTYPE html>
      <html>
      <body>
        <comp-provider>
          <comp-consumer></comp-consumer>
        </comp-provider>
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
    assert.ok(html.includes('/provide-page.html'), 'Component provide block must receive route')
  })

  it('two components on the same page receive the same route', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'comp-one.html'),
      `<template id="comp-one">
        <div id="c1">{{ c1Path }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            c1Path: ({ route }) => route.path
          }
        })
      </script>`
    )

    await writeFile(
      join(COMPONENTS_DIR, 'comp-two.html'),
      `<template id="comp-two">
        <div id="c2">{{ c2Path }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            c2Path: ({ route }) => route.path
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'multi-comp.html'),
      `<!DOCTYPE html>
      <html>
      <body>
        <comp-one></comp-one>
        <comp-two></comp-two>
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
    assert.ok(html.includes('/multi-comp.html'))
  })

  it('a component rendered via slots projection receives the host page route', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'slot-wrapper.html'),
      `<template id="slot-wrapper">
        <div class="wrapper">
          <slot></slot>
        </div>
      </template>`
    )

    await writeFile(
      join(COMPONENTS_DIR, 'projected-comp.html'),
      `<template id="projected-comp">
        <span id="proj">{{ projPath }}</span>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            projPath: ({ route }) => route.path
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'projection-page.html'),
      `<!DOCTYPE html>
      <html>
      <body>
        <slot-wrapper>
          <projected-comp></projected-comp>
        </slot-wrapper>
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
    assert.ok(html.includes('/projection-page.html'))
  })

  it('negative assertion: component style does not receive route object', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'style-route-comp.html'),
      `<template id="style-route-comp">
        <div class="styled">Style Comp</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          style: {
            '--check': (state) => {
              const hasRouteProperty = Boolean(state && state.route)
              return hasRouteProperty ? 'failed' : 'passed'
            }
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'style-test.html'),
      `<!DOCTYPE html>
      <html>
      <body>
        <style-route-comp></style-route-comp>
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
    assert.ok(html.includes('--check: passed') || html.includes('--check:passed'))
    assert.ok(!html.includes('--check: failed') && !html.includes('--check:failed'))
  })
})
