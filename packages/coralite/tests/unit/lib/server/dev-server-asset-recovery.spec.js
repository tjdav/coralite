import '../../setup.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import http from 'node:http'
import server from '../../../../lib/cli/server.js'
import { buildCommand } from '../../../../lib/cli/commands/build.js'

function request (url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          type: res.headers['content-type'] || '',
          body: Buffer.concat(chunks).toString('utf8')
        })
      })
    }).on('error', reject)
  })
}

function extractAssetUrls (html) {
  return [...new Set(html.match(/\/assets\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.[A-Za-z0-9]+/g) || [])]
}

function closeServer (listener) {
  return new Promise((resolve) => listener.close(resolve))
}

describe('Dev server asset recovery', () => {
  const TEST_DIR = join(tmpdir(), 'coralite-dev-asset-recovery-' + randomUUID())
  const PAGES_DIR = join(TEST_DIR, 'pages')
  const COMPONENTS_DIR = join(TEST_DIR, 'components')
  const OUTPUT_DIR = join(TEST_DIR, '.coralite')
  const PUBLIC_DIR = join(TEST_DIR, 'public')
  const STYLES_DIR = join(TEST_DIR, 'styles')
  const STATIC_DIR = join(TEST_DIR, 'static')

  let config
  let listener
  let base

  before(async () => {
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
    await mkdir(PUBLIC_DIR, { recursive: true })
    await mkdir(STYLES_DIR, { recursive: true })
    await mkdir(STATIC_DIR, { recursive: true })

    await writeFile(join(COMPONENTS_DIR, 'x-widget.html'), `<template id="x-widget">
  <button ref="button">Click {{ label }}</button>
</template>
<script type="module">
  export const attributes = { label: { type: String, default: 'me' } }

  export async function client ({ refs }) {
    refs('button').addEventListener('click', () => console.log('clicked'))
  }
</script>
<style>
  :host { display: block }
</style>
`)

    await writeFile(join(PAGES_DIR, 'index.html'), `<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <p data-render="{{ renderMarker }}">Home</p>
  <x-widget label="home"></x-widget>
</body>
</html>

<script type="module">
  export function server () {
    return { renderMarker: String(Date.now()) }
  }
</script>
`)

    await writeFile(join(PAGES_DIR, 'compare.html'), `<!DOCTYPE html>
<html>
<head><title>Compare</title></head>
<body>
  <p data-render="{{ renderMarker }}">Compare</p>
  <x-widget label="compare"></x-widget>
</body>
</html>

<script type="module">
  export function server () {
    return { renderMarker: String(Date.now()) }
  }
</script>
`)

    await writeFile(join(STYLES_DIR, 'why.css'), ':root { --why: 1; }\n')
    await writeFile(join(STATIC_DIR, 'vendor-test.js'), 'console.log("vendor")\n')

    config = {
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      public: PUBLIC_DIR,
      styles: {
        input: [join(STYLES_DIR, 'why.css')]
      },
      assets: [{
        src: join(STATIC_DIR, 'vendor-test.js'),
        dest: 'assets/js/vendor-test.js'
      }],
      plugins: [],
      cleanUrls: true,
      server: {
        port: 4500 + Math.floor(Math.random() * 300)
      }
    }

    listener = await server(config, {}, 'dev')
    base = `http://127.0.0.1:${listener.address().port}`
  })

  after(async () => {
    if (listener) {
      await closeServer(listener)
    }
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    }).catch(() => {
    })
  })

  it('writes the dev manifest under the mode-scoped cache directory', async () => {
    await request(base + '/compare')
    const manifest = await readFile(join(OUTPUT_DIR, 'dev', 'manifest.json'), 'utf8')
    assert.match(manifest, /"components"/)
    await assert.rejects(access(join(OUTPUT_DIR, 'manifest.json')))
  })

  it('serves a cached page without re-rendering and restores deleted assets on request', async () => {
    const first = await request(base + '/compare')
    assert.equal(first.status, 200)
    const firstMarker = first.body.match(/data-render="([^"]+)"/)?.[1]
    assert.ok(firstMarker, 'Expected a render marker')

    const assetUrls = extractAssetUrls(first.body)
    assert.ok(assetUrls.length > 0, 'Expected generated asset URLs')
    assert.ok(assetUrls.includes('/assets/css/why.css'), 'Expected external stylesheet URL')

    await rm(join(OUTPUT_DIR, 'assets'), {
      recursive: true,
      force: true
    })

    await new Promise(resolve => setTimeout(resolve, 5))

    const second = await request(base + '/compare')
    assert.equal(second.status, 200)
    const secondMarker = second.body.match(/data-render="([^"]+)"/)?.[1]
    assert.equal(secondMarker, firstMarker, 'Cached page must not be re-rendered')

    for (const assetUrl of assetUrls) {
      const asset = await request(base + assetUrl)
      assert.equal(asset.status, 200, `Expected ${assetUrl} to recover`)
      assert.ok(asset.body.length > 0, `Expected ${assetUrl} to have content`)
      if (assetUrl.endsWith('.js')) {
        assert.match(asset.type, /javascript/)
      }
      if (assetUrl.endsWith('.css')) {
        assert.match(asset.type, /text\/css/)
      }
      await access(join(OUTPUT_DIR, assetUrl.slice(1)))
    }
  })

  it('re-emits a single deleted asset without a page request', async () => {
    const manifestPath = join(OUTPUT_DIR, 'assets', 'js', 'manifest.js')
    await access(manifestPath)
    await rm(manifestPath)

    const response = await request(base + '/assets/js/manifest.js')
    assert.equal(response.status, 200)
    assert.match(response.type, /javascript/)
    await access(manifestPath)
  })

  it('restores configured static assets on request', async () => {
    const staticPath = join(OUTPUT_DIR, 'assets', 'js', 'vendor-test.js')
    await rm(staticPath, { force: true })

    const response = await request(base + '/assets/js/vendor-test.js')
    assert.equal(response.status, 200)
    assert.match(response.body, /vendor/)
    await access(staticPath)
  })

  it('returns an actionable 404 for an unknown asset', async () => {
    const response = await request(base + '/assets/js/missing-DOESNOTEXIST.js')
    assert.equal(response.status, 404)
    assert.match(response.type, /text\/plain/)
    assert.match(response.body, /Unable to restore asset/)
  })
})

describe('Dev server clean and test-mode recovery', () => {
  const TEST_DIR = join(tmpdir(), 'coralite-dev-asset-clean-' + randomUUID())
  const PAGES_DIR = join(TEST_DIR, 'pages')
  const COMPONENTS_DIR = join(TEST_DIR, 'components')
  const OUTPUT_DIR = join(TEST_DIR, '.coralite')
  const PUBLIC_DIR = join(TEST_DIR, 'public')

  let config
  let listeners

  before(async () => {
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
    await mkdir(PUBLIC_DIR, { recursive: true })

    await writeFile(join(PAGES_DIR, 'index.html'), '<!DOCTYPE html><html><body>Home</body></html>')

    config = {
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      public: PUBLIC_DIR,
      plugins: [],
      cleanUrls: true,
      server: {
        port: 4800 + Math.floor(Math.random() * 300)
      }
    }

    listeners = []
  })

  after(async () => {
    for (const listener of listeners) {
      await closeServer(listener)
    }
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    }).catch(() => {
    })
  })

  it('removes only the mode output when clean is requested', async () => {
    const staleFile = join(OUTPUT_DIR, 'stale.txt')
    await writeFile(staleFile, 'stale')

    const listener = await server(config, { clean: true }, 'dev')
    listeners.push(listener)

    await assert.rejects(access(staleFile))
  })

  it('rebuilds a skipped page instead of returning 404 in test mode', async () => {
    const testConfig = {
      ...config,
      server: {
        port: config.server.port + 1
      }
    }

    const firstListener = await server(testConfig, {}, 'test')
    const firstBase = `http://127.0.0.1:${firstListener.address().port}`
    const first = await request(firstBase + '/')
    assert.equal(first.status, 200)
    await closeServer(firstListener)

    const secondListener = await server({
      ...testConfig,
      server: {
        port: config.server.port + 2
      }
    }, {}, 'test')
    listeners.push(secondListener)
    const secondBase = `http://127.0.0.1:${secondListener.address().port}`
    const second = await request(secondBase + '/')
    assert.equal(second.status, 200)
    assert.match(second.body, /Home/)
  })
})

describe('Build cache separation', () => {
  const TEST_DIR = join(tmpdir(), 'coralite-build-cache-' + randomUUID())
  const PAGES_DIR = join(TEST_DIR, 'pages')
  const COMPONENTS_DIR = join(TEST_DIR, 'components')
  const PUBLIC_DIR = join(TEST_DIR, 'public')
  const OUTPUT_DIR = join(TEST_DIR, 'dist')

  const logger = {
    write () {
    },
    info () {
    },
    warn () {
    },
    error () {
    },
    spinner () {
      return {
        start () {
          return this
        },
        succeed () {
        },
        fail () {
        },
        stop () {
        }
      }
    }
  }

  before(async () => {
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PUBLIC_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })

    await writeFile(join(PAGES_DIR, 'index.html'), '<!DOCTYPE html><html><body>Home</body></html>')
  })

  after(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    }).catch(() => {
    })
  })

  it('writes the production manifest to the build-scoped cache directory', async () => {
    await buildCommand({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      public: PUBLIC_DIR,
      plugins: [],
      cleanUrls: true
    }, {
      incremental: false,
      incrementalSource: 'cli'
    }, logger)

    const manifest = await readFile(join(TEST_DIR, '.coralite', 'build', 'manifest.json'), 'utf8')
    assert.match(manifest, /"components"/)
    await access(join(OUTPUT_DIR, 'index.html'))
    await assert.rejects(access(join(TEST_DIR, '.coralite', 'manifest.json')))
  })
})
