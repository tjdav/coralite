import { describe, it } from 'node:test'
import assert from 'node:assert'
import createCoralite from '../../../lib/coralite.js'
import { calculateHash } from '../../../lib/utils/server/csp.js'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'

const tmpDir = join(process.cwd(), 'tests', 'unit', 'fixtures', 'csp-parity-tmp')

async function setupTestProject () {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, 'pages'), { recursive: true })
  await mkdir(join(tmpDir, 'components'), { recursive: true })

  await writeFile(
    join(tmpDir, 'components', 'x-counter.html'),
    `<template id="x-counter">
      <button ref="btn">Count: {{ count }}</button>
    </template>
    <script type="module">
      import { defineComponent } from 'coralite'

      export default defineComponent({
        client ({ state }) {
          state.count = 0
        }
      })
    </script>
    <style>
      button { color: red; }
    </style>`
  )

  await writeFile(
    join(tmpDir, 'pages', 'index.html'),
    `<!DOCTYPE html>
    <html>
      <head>
        <title>CSP Test</title>
      </head>
      <body>
        <x-counter></x-counter>
      </body>
    </html>`
  )
}

async function cleanupTestProject () {
  await rm(tmpDir, { recursive: true, force: true })
}

describe('CSP Renderer Modes & Parity', () => {
  it('SSG Hash Mode computes exact post-serialization script and style hashes', async () => {
    await setupTestProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        csp: {
          enabled: true,
          injectMeta: true
        },
        mode: 'production',
        incremental: false
      })

      const results = await app.build(null, { incremental: false })
      assert.strictEqual(results.length, 1)

      const result = results[0]
      const html = result.content

      assert.ok(result.csp)
      assert.strictEqual(result.csp.mode, 'hash')
      assert.ok(result.csp.scriptHashes.length > 0)
      assert.ok(result.csp.styleHashes.length > 0)

      // Verify that every hash in result.csp.scriptHashes corresponds to an inline script content hash
      const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
      const scriptContents = scriptMatches.map(m => m[1])

      for (const h of result.csp.scriptHashes) {
        const found = scriptContents.some(content => calculateHash(content, 'sha256') === h)
        assert.strictEqual(found, true, `Hash ${h} should match an inline script in generated HTML`)
      }

      // Verify style hashes
      const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
      const styleContents = styleMatches.map(m => m[1])

      for (const h of result.csp.styleHashes) {
        const found = styleContents.some(content => calculateHash(content, 'sha256') === h)
        assert.strictEqual(found, true, `Hash ${h} should match an inline style in generated HTML`)
      }

      // Verify meta tag content
      assert.ok(html.includes('<meta http-equiv="Content-Security-Policy" content='))
    } finally {
      await cleanupTestProject()
    }
  })

  it('SSR Nonce Mode applies nonce attribute and skips hash calculation', async () => {
    await setupTestProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        csp: {
          enabled: true,
          nonce: 'my-nonce-123',
          injectMeta: true
        },
        mode: 'production',
        incremental: false
      })

      const results = await app.build(null, { incremental: false })
      const result = results[0]
      const html = result.content

      assert.strictEqual(result.csp.mode, 'nonce')
      assert.strictEqual(result.csp.nonce, 'my-nonce-123')
      assert.strictEqual(result.csp.scriptHashes.length, 0)
      assert.strictEqual(result.csp.styleHashes.length, 0)

      assert.ok(html.includes('nonce="my-nonce-123"'))
      assert.ok(html.includes("script-src 'self' 'strict-dynamic' 'nonce-my-nonce-123'"))
      assert.ok(html.includes("style-src 'self' 'nonce-my-nonce-123'"))
    } finally {
      await cleanupTestProject()
    }
  })

  it('External Scripts Mode externalizes client runtime bootstrap', async () => {
    await setupTestProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        csp: {
          enabled: true,
          externalScripts: true,
          injectMeta: true
        },
        mode: 'production',
        incremental: false
      })

      const results = await app.build(null, { incremental: false })
      const result = results[0]
      const html = result.content

      assert.strictEqual(result.csp.mode, 'external')
      // Import map remains inline per HTML spec, so scriptHashes contains importmap hash
      assert.strictEqual(result.csp.scriptHashes.length, 1)

      assert.ok(html.includes('<script type="importmap"'))
      assert.ok(html.includes('<script type="module" src="/assets/js/pages/index-'))
    } finally {
      await cleanupTestProject()
    }
  })

  it('External Styles Mode bundles inline component styles into external CSS', async () => {
    await setupTestProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        csp: {
          enabled: true,
          externalStyles: true,
          injectMeta: true
        },
        mode: 'production',
        incremental: false
      })

      const results = await app.build(null, { incremental: false })
      const result = results[0]
      const html = result.content

      assert.strictEqual(result.csp.styleHashes.length, 0)
      assert.ok(html.includes('<link rel="stylesheet" href="/assets/css/coralite-inline-'))
      assert.ok(!html.includes('<style id="coralite-components">'))
      assert.ok(!html.includes('<style id="coralite-inline-styles">'))
    } finally {
      await cleanupTestProject()
    }
  })
})
