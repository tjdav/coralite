import '../../setup.js'
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import http from 'node:http'
import { createCoralite } from '../../../../lib/server/create.js'
import server from '../../../../lib/cli/server.js'

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

describe('Dev server cleanUrls:false nested index pages', () => {
  const TEST_DIR = join(tmpdir(), 'coralite-dev-cleanurls-index-' + randomUUID())
  const PAGES_DIR = join(TEST_DIR, 'pages')
  const COMPONENTS_DIR = join(TEST_DIR, 'components')
  const OUTPUT_DIR = join(TEST_DIR, 'dist')
  const PUBLIC_DIR = join(TEST_DIR, 'public')

  let app
  let config

  before(async () => {
    await mkdir(join(PAGES_DIR, 'docs', 'guide'), { recursive: true })
    await mkdir(join(PAGES_DIR, 'docs', 'reference'), { recursive: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
    await mkdir(PUBLIC_DIR, { recursive: true })

    await writeFile(join(PAGES_DIR, 'index.html'), '<!DOCTYPE html><html><body>Home</body></html>')
    await writeFile(join(PAGES_DIR, 'docs', 'guide', 'index.html'), '<!DOCTYPE html><html><body>Guide Overview</body></html>')
    await writeFile(join(PAGES_DIR, 'docs', 'reference', 'index.html'), '<!DOCTYPE html><html><body>Reference Overview</body></html>')
    await writeFile(join(PAGES_DIR, 'docs', 'guide', 'getting-started.html'), '<!DOCTYPE html><html><body>Getting Started</body></html>')

    config = {
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      public: PUBLIC_DIR,
      plugins: [],
      cleanUrls: false,
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

  it('serves nested index pages through their .html aliases', async () => {
    const listener = await server({
      ...config,
      server: {
        port: 4322
      }
    }, {}, 'test')

    assert.ok(listener, 'Server listener should be returned')

    try {
      const port = listener.address().port

      const guide = await getRequest(`http://127.0.0.1:${port}/docs/guide.html`)
      assert.equal(guide.status, 200)
      assert.match(await guide.text(), /Guide Overview/)

      const reference = await getRequest(`http://127.0.0.1:${port}/docs/reference.html`)
      assert.equal(reference.status, 200)
      assert.match(await reference.text(), /Reference Overview/)

      const nested = await getRequest(`http://127.0.0.1:${port}/docs/guide/getting-started.html`)
      assert.equal(nested.status, 200)
      assert.match(await nested.text(), /Getting Started/)
    } finally {
      await new Promise(resolve => listener.close(resolve))
    }
  })
})
