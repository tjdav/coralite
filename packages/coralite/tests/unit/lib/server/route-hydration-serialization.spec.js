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

describe('Route Hydration Payload Serialization', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-route-hydration-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    PAGES_DIR = join(TEST_DIR, 'pages')
    OUTPUT_DIR = join(TEST_DIR, 'dist')

    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })

    // Card component with client block and state
    await writeFile(
      join(COMPONENTS_DIR, 'card-comp.html'),
      `<template id="card-comp">
        <div class="card">{{ title }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          attributes: { title: String },
          client: ({ state }) => {}
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

  it('serializes __route__ into hydration payload for static pages', async () => {
    await writeFile(
      join(PAGES_DIR, 'about.html'),
      `<!DOCTYPE html>
<html>
<head><title>About</title></head>
<body>
  <card-comp title="About Us"></card-comp>
  <script type="module">
    import { definePage } from 'coralite'
    export default definePage({
      client: ({ state }) => {}
    })
  </script>
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
    assert.ok(html.includes('window.__coralite_hydration__ = Object.assign('))

    // Extract serialized hydration payload from generated HTML
    const match = html.match(/window\.__coralite_hydration__\s*=\s*Object\.assign\(\s*\{\},\s*window\.__coralite_hydration__\s*\|\|\s*\{\},\s*(\{[\s\S]*?\})\s*\);/)
    assert.ok(match, 'Hydration payload script should be found')

    const payload = Function(`return ${match[1]}`)()
    assert.ok(payload.__route__, 'Payload must contain __route__ key')
    assert.equal(payload.__route__.dynamic, false)
    assert.deepEqual(payload.__route__.params, {})
    assert.equal(payload.__route__.path, payload.__route__.pattern)

    // Check component instance state is preserved and key does not collide
    assert.ok(payload['card-comp-0'], 'Component instance key should exist in payload')
    assert.notEqual(payload.__route__, payload['card-comp-0'])
  })

  it('serializes __route__ into hydration payload for dynamic pages', async () => {
    await mkdir(join(PAGES_DIR, 'posts'), { recursive: true })
    await writeFile(
      join(PAGES_DIR, 'posts', '[id].html'),
      `<!DOCTYPE html>
<html>
<head><title>Post</title></head>
<body>
  <card-comp title="Post Detail"></card-comp>
  <script type="module">
    import { definePage } from 'coralite'
    export default definePage({
      paths() {
        return [{ id: 'intro' }]
      },
      client: ({ state }) => {}
    })
  </script>
</body>
</html>`
    )

    const routePlugin = definePlugin({
      name: 'test-route-plugin',
      server: {
        onBeforePageRender ({ page }) {
          page.route = {
            path: '/posts/intro',
            pattern: '/posts/[id]',
            params: { id: 'intro' },
            dynamic: true
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
    const match = html.match(/window\.__coralite_hydration__\s*=\s*Object\.assign\(\s*\{\},\s*window\.__coralite_hydration__\s*\|\|\s*\{\},\s*(\{[\s\S]*?\})\s*\);/)
    assert.ok(match, 'Hydration payload script should be found')

    const payload = Function(`return ${match[1]}`)()
    assert.ok(payload.__route__, 'Payload must contain __route__ key')

    assert.equal(payload.__route__.path, '/posts/intro')
    assert.equal(payload.__route__.pattern, '/posts/[id]')
    assert.equal(payload.__route__.params.id, 'intro')
    assert.equal(payload.__route__.dynamic, true)

    // Key non-collision check
    assert.ok(payload['card-comp-0'])
    assert.notEqual(payload.__route__, payload['card-comp-0'])
  })
})
