import '../../setup.js'
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import http from 'node:http'
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

function wait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('Dev server lazy dynamic routes', () => {
  const TEST_DIR = join(tmpdir(), 'coralite-dev-lazy-' + randomUUID())
  const PAGES_DIR = join(TEST_DIR, 'pages')
  const COMPONENTS_DIR = join(TEST_DIR, 'components')
  const OUTPUT_DIR = join(TEST_DIR, 'dist')
  const PUBLIC_DIR = join(TEST_DIR, 'public')

  const page = (title = 'v1') => `<!DOCTYPE html>
<html><body><h1>{{ title }}</h1></body></html>
<script type="module">
  export function paths () {
    return [{ id: 'one' }, { id: 'two' }, { id: 'three' }, { id: 'four' }, { id: 'five' }]
  }
  export function server () {
    return { title: '${title}' }
  }
</script>`

  beforeEach(async () => {
    await mkdir(join(PAGES_DIR, 'posts'), { recursive: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
    await mkdir(PUBLIC_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    }).catch(() => {
    })
  })

  const config = (overrides = {}) => ({
    projectRoot: TEST_DIR,
    components: COMPONENTS_DIR,
    pages: PAGES_DIR,
    public: PUBLIC_DIR,
    output: OUTPUT_DIR,
    plugins: [],
    cleanUrls: true,
    server: { port: 4541 },
    ...overrides
  })

  it('serves requested outputs lazily and applies the dev route cap', async () => {
    await writeFile(join(PAGES_DIR, 'posts', '[id].html'), page())
    const listener = await server(config({ dev: { maxPages: 2 } }), {}, 'dev')

    try {
      const port = listener.address().port
      const baseUrl = `http://127.0.0.1:${port}`

      const first = await getRequest(`${baseUrl}/posts/one`)
      assert.equal(first.status, 200)
      assert.ok((await first.text()).includes('v1'))

      const second = await getRequest(`${baseUrl}/posts/two`)
      assert.equal(second.status, 200)

      const capped = await getRequest(`${baseUrl}/posts/four`)
      assert.equal(capped.status, 404)
    } finally {
      await new Promise(resolve => listener.close(resolve))
    }
  })

  it('refreshes changed page sources for HMR', async () => {
    const pagePath = join(PAGES_DIR, 'posts', '[id].html')
    await writeFile(pagePath, page('v1'))
    const listener = await server(config({ server: { port: 4542 } }), {}, 'dev')

    try {
      const port = listener.address().port
      const baseUrl = `http://127.0.0.1:${port}`

      const first = await getRequest(`${baseUrl}/posts/one`)
      assert.equal(first.status, 200)
      assert.ok((await first.text()).includes('v1'))

      await writeFile(pagePath, page('v2'))
      await wait(500)

      const second = await getRequest(`${baseUrl}/posts/one`)
      assert.equal(second.status, 200)
      assert.ok((await second.text()).includes('v2'))
    } finally {
      await new Promise(resolve => listener.close(resolve))
    }
  })
})
