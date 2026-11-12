import '../../setup.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '../../../../lib/server/create.js'

describe('Dynamic locale render isolation', () => {
  const TEST_DIR = join(tmpdir(), 'coralite-locale-isolation-')
  const PAGES_DIR = join(TEST_DIR, 'pages')
  const COMPONENTS_DIR = join(TEST_DIR, 'components')
  const OUTPUT_DIR = join(TEST_DIR, 'dist')

  let app

  before(async () => {
    await mkdir(join(PAGES_DIR, '[lang]'), { recursive: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })

    const localePage = `<!DOCTYPE html>
<html lang="{{ lang }}">
<head>
  <title>Login {{ lang }}</title>
</head>
<body>
  <h1>Login {{ lang }}</h1>
  <p>Language: {{ lang }}</p>
</body>
</html>

<script type="module">
  import { definePage } from 'coralite'

  export default definePage({
    paths: async () => [
      { lang: 'ca' },
      { lang: 'es' }
    ],
    async server ({ route }) {
      return {
        lang: route.params.lang
      }
    },
    async client ({ root, state }) {}
  })
</script>`
    await writeFile(join(PAGES_DIR, '[lang]', 'index.html'), localePage)

    app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'development',
      incremental: false
    })
  })

  after(async () => {
    if (app) {
      await app.clearCache(true)
    }
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('renders each enumerated locale with its own route state during a concurrent build', async () => {
    const results = await app.build()

    const caResult = results.find(result => result.route?.path === '/ca')
    const esResult = results.find(result => result.route?.path === '/es')

    assert.ok(caResult, 'Build should produce a result for /ca')
    assert.ok(esResult, 'Build should produce a result for /es')

    const caBody = caResult.content.replace(/\s+/g, ' ')
    const esBody = esResult.content.replace(/\s+/g, ' ')

    assert.ok(
      caBody.includes('<html lang="ca"'),
      `CA document should declare lang="ca", got: ${caBody.slice(0, 200)}`
    )
    assert.ok(
      caBody.includes('<p>Language: ca</p>') || caBody.includes('Language: {{ lang }}'),
      `CA document should carry CA server state or a reactive lang token, got: ${caBody.slice(0, 300)}`
    )
    assert.ok(
      esBody.includes('<html lang="es"'),
      `ES document should declare lang="es", got: ${esBody.slice(0, 200)}`
    )
    assert.ok(
      esBody.includes('<p>Language: es</p>') || esBody.includes('Language: {{ lang }}'),
      `ES document should carry ES server state or a reactive lang token, got: ${esBody.slice(0, 300)}`
    )
  })

  it('assigns a distinct page token to each enumerated locale', async () => {
    const results = await app.build()

    const caResult = results.find(result => result.route?.path === '/ca')
    const esResult = results.find(result => result.route?.path === '/es')

    assert.ok(caResult, 'Build should produce a result for /ca')
    assert.ok(esResult, 'Build should produce a result for /es')

    const caToken = caResult.content.match(/data-coralite-page-token="([^"]*)"/)
    const esToken = esResult.content.match(/data-coralite-page-token="([^"]*)"/)

    assert.ok(caToken, 'CA document should carry a page token')
    assert.ok(esToken, 'ES document should carry a page token')
    assert.notStrictEqual(caToken[1], esToken[1], 'Each locale should carry a distinct page token')
  })
})
