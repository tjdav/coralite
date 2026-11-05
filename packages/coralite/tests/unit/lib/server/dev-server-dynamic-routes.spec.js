import '../../setup.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { stripPageTokenMarkers } from '../../helpers.js'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import http from 'node:http'
import { createCoralite } from '../../../../lib/server/create.js'
import server, { resolveSource } from '../../../../lib/cli/server.js'

function getRequest (url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          text: () => Promise.resolve(data)
        })
      })
    }).on('error', reject)
  })
}

describe('Dev and test server dynamic route resolution', () => {
  const TEST_DIR = join(tmpdir(), 'coralite-dev-dynamic-' + randomUUID())
  const PAGES_DIR = join(TEST_DIR, 'pages')
  const COMPONENTS_DIR = join(TEST_DIR, 'components')
  const OUTPUT_DIR = join(TEST_DIR, 'dist')
  const PUBLIC_DIR = join(TEST_DIR, 'public')
  const FIXTURES_DIR = join(TEST_DIR, 'fixtures')

  let app
  let config

  before(async () => {
    await mkdir(join(PAGES_DIR, '[lang]', 'events'), { recursive: true })
    await mkdir(join(PAGES_DIR, 'docs', '[...slug]'), { recursive: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
    await mkdir(PUBLIC_DIR, { recursive: true })
    await mkdir(join(FIXTURES_DIR, 'catalog', '[id]'), { recursive: true })

    // 1. Dynamic page with parameters: [lang]/events/[slug].html
    const dynamicEventPage = `<!DOCTYPE html>
<html lang="{{ lang }}">
<head>
  <title>{{ title }}</title>
</head>
<body>
  <h1>{{ title }}</h1>
  <p>Language: {{ lang }}</p>
  <p>Slug: {{ slug }}</p>
</body>
</html>

<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    paths: async () => [
      { lang: 'ca', slug: 'don-giovanni' },
      { lang: 'es', slug: 'don-giovanni' }
    ],
    async server ({ route }) {
      return {
        title: 'Event: ' + route.params.slug,
        lang: route.params.lang,
        slug: route.params.slug
      }
    }
  })
</script>`
    await writeFile(join(PAGES_DIR, '[lang]', 'events', '[slug].html'), dynamicEventPage)

    // 2. Dynamic catch-all page: docs/[...slug]/index.html
    const catchallDocPage = `<!DOCTYPE html>
<html>
<head><title>Docs</title></head>
<body>
  <h1>Doc: {{ path }}</h1>
</body>
</html>

<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    paths: async () => [
      { slug: 'intro' },
      { slug: 'api/v1' }
    ],
    async server ({ route }) {
      return {
        path: route.params.slug
      }
    }
  })
</script>`
    await writeFile(join(PAGES_DIR, 'docs', '[...slug]', 'index.html'), catchallDocPage)

    // 3. Dynamic fixture page: catalog/[id]/index.html
    const fixturePage = `<!DOCTYPE html>
<html>
<body>
  <p>Item: {{ id }}</p>
</body>
</html>

<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    paths: async () => [
      { id: '100' }
    ],
    async server ({ route }) {
      return {
        id: route.params.id
      }
    }
  })
</script>`
    await writeFile(join(FIXTURES_DIR, 'catalog', '[id]', 'index.html'), fixturePage)

    config = {
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      public: PUBLIC_DIR,
      fixtures: {
        pages: FIXTURES_DIR,
        prefix: '/__fixtures__'
      },
      output: OUTPUT_DIR,
      plugins: [],
      cleanUrls: true,
      mode: 'testing'
    }

    app = await createCoralite(config)
  })

  after(async () => {
    if (app) {
      await app.clearCache(true)
    }
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    }).catch(() => {
    })
  })

  it('resolveSource resolves dynamic route with matching enumerated path parameters', async () => {
    const memoryPageSource = new Map()
    const resolved = await resolveSource('/ca/events/don-giovanni', '', config, app, memoryPageSource)

    assert.ok(resolved, 'Expected /ca/events/don-giovanni to resolve')
    assert.strictEqual(resolved.pathname, join(PAGES_DIR, '[lang]', 'events', '[slug].html'))
    assert.strictEqual(resolved.key, 'ca/events/don-giovanni.html')
    assert.strictEqual(resolved.isFixture, false)
  })

  it('resolveSource resolves alternative enumerated path parameter for the same template', async () => {
    const memoryPageSource = new Map()
    const resolved = await resolveSource('/es/events/don-giovanni', '', config, app, memoryPageSource)

    assert.ok(resolved, 'Expected /es/events/don-giovanni to resolve')
    assert.strictEqual(resolved.pathname, join(PAGES_DIR, '[lang]', 'events', '[slug].html'))
    assert.strictEqual(resolved.key, 'es/events/don-giovanni.html')
  })

  it('resolveSource returns null for parameters not present in enumerated paths (404 rejection)', async () => {
    const memoryPageSource = new Map()
    const resolved = await resolveSource('/ca/events/unknown-opera', '', config, app, memoryPageSource)

    assert.strictEqual(resolved, null, 'Unenumerated dynamic parameter must return null (404)')
  })

  it('resolveSource resolves catch-all dynamic route', async () => {
    const memoryPageSource = new Map()
    const resolved = await resolveSource('/docs/api/v1', '', config, app, memoryPageSource)

    assert.ok(resolved, 'Expected /docs/api/v1 to resolve')
    assert.strictEqual(resolved.pathname, join(PAGES_DIR, 'docs', '[...slug]', 'index.html'))
    assert.strictEqual(resolved.key, 'docs/api/v1.html')
  })

  it('resolveSource resolves dynamic fixture page', async () => {
    const memoryPageSource = new Map()
    const resolved = await resolveSource('/__fixtures__/catalog/100', '', config, app, memoryPageSource)

    assert.ok(resolved, 'Expected /__fixtures__/catalog/100 to resolve')
    assert.strictEqual(resolved.pathname, join(FIXTURES_DIR, 'catalog', '[id]', 'index.html'))
    assert.strictEqual(resolved.isFixture, true)
  })

  it('dev server handles HTTP requests to dynamic routes with populated route.params in server mode', async () => {
    const serverConfig = {
      ...config,
      server: {
        port: 4321
      }
    }

    const listener = await server(serverConfig, {}, 'test')
    assert.ok(listener, 'Server listener should be returned')

    try {
      const port = listener.address().port

      // 1. Request matching dynamic route /ca/events/don-giovanni
      const resCa = await getRequest(`http://127.0.0.1:${port}/ca/events/don-giovanni`)
      assert.strictEqual(resCa.status, 200)
      const htmlCa = await resCa.text()
      assert.ok(stripPageTokenMarkers(htmlCa).includes('<p>Language: ca</p>'), 'Rendered HTML should contain language ca')
      assert.ok(stripPageTokenMarkers(htmlCa).includes('<p>Slug: don-giovanni</p>'), 'Rendered HTML should contain slug don-giovanni')
      assert.ok(stripPageTokenMarkers(htmlCa).includes('<h1>Event: don-giovanni</h1>'), 'Rendered HTML should contain server() generated title')

      // 2. Request alternative enumerated route /es/events/don-giovanni
      const resEs = await getRequest(`http://127.0.0.1:${port}/es/events/don-giovanni`)
      assert.strictEqual(resEs.status, 200)
      const htmlEs = await resEs.text()
      assert.ok(stripPageTokenMarkers(htmlEs).includes('<p>Language: es</p>'), 'Rendered HTML should contain language es')

      // 3. Request unenumerated route /ca/events/nonexistent -> 404
      const res404 = await getRequest(`http://127.0.0.1:${port}/ca/events/nonexistent`)
      assert.strictEqual(res404.status, 404)
    } finally {
      await new Promise(resolve => listener.close(resolve))
    }
  })
})
