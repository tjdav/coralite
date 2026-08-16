import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import createCoralite from '../../../lib/coralite.js'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'

const tmpDir = join(process.cwd(), 'tests', 'unit', 'fixtures', 'renderer-csp-tmp')

async function setupTestProject () {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(join(tmpDir, 'pages'), { recursive: true })
  await mkdir(join(tmpDir, 'components'), { recursive: true })

  await writeFile(
    join(tmpDir, 'components', 'a-button.html'),
    `<template id="a-button">
      <button>Click me</button>
    </template>
    <script type="module">
      import { defineComponent } from 'coralite'
      export default defineComponent({})
    </script>
    <style>
      button { color: blue; }
    </style>`
  )

  await writeFile(
    join(tmpDir, 'pages', 'index.html'),
    `<!DOCTYPE html>
    <html>
      <head><title>Test</title></head>
      <body><a-button></a-button></body>
    </html>`
  )

  await writeFile(
    join(tmpDir, 'pages', 'meta-page.html'),
    `<!DOCTYPE html>
<html>
  <head>
    <title>Meta Test</title>
    <meta name="csp" content="true">
    <meta name="csp-directives" content='{"script-src":["self","unsafe-eval"]}'>
  </head>
  <body><a-button></a-button></body>
</html>`
  )
}

async function cleanupTestProject () {
  await rm(tmpDir, { recursive: true, force: true })
}

describe('Renderer CSP Coverage', () => {
  it('SSG Hash Mode computes script and style hashes and injects meta tag when configured', async () => {
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

      const results = await app.build('index.html', { incremental: false })
      const result = results[0]
      assert.strictEqual(result.csp.mode, 'hash')
      assert.ok(result.csp.scriptHashes.length > 0)
      assert.ok(result.csp.styleHashes.length > 0)
      assert.ok(result.content.includes('<meta http-equiv="Content-Security-Policy" content='))
    } finally {
      await cleanupTestProject()
    }
  })

  it('SSR Nonce Mode applies nonce to inline elements and suppresses hashes', async () => {
    await setupTestProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        csp: {
          enabled: true,
          nonce: 'unique-nonce-abc',
          injectMeta: true
        },
        mode: 'production',
        incremental: false
      })

      const results = await app.build('index.html', { incremental: false })
      const result = results[0]
      assert.ok(result.csp)
      assert.strictEqual(result.csp.mode, 'nonce')
      assert.strictEqual(result.csp.nonce, 'unique-nonce-abc')
      assert.strictEqual(result.csp.scriptHashes.length, 0)
      assert.strictEqual(result.csp.styleHashes.length, 0)
      assert.ok(result.content.includes('nonce="unique-nonce-abc"'))
    } finally {
      await cleanupTestProject()
    }
  })

  it('Page Meta CSP Directives (JSON string) are parsed and merged', async () => {
    await setupTestProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        csp: {
          enabled: true,
          injectMeta: true,
          directives: {
            'default-src': ["'self'"]
          }
        },
        mode: 'production',
        incremental: false
      })

      const results = await app.build('meta-page.html', { incremental: false })
      const result = results[0]
      assert.ok(result.csp)
      assert.ok(result.csp.header.includes("default-src 'self'"))
      assert.ok(result.csp.directives['script-src'].includes('unsafe-eval'))
      assert.ok(result.csp.header.includes('unsafe-eval'))
    } finally {
      await cleanupTestProject()
    }
  })

  it('csp.enabled === false overrides and disables externalScripts and externalStyles', async () => {
    await setupTestProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        csp: {
          enabled: false,
          externalScripts: true,
          externalStyles: true
        },
        mode: 'production',
        incremental: false
      })

      const results = await app.build('index.html', { incremental: false })
      const result = results[0]
      assert.strictEqual(result.csp, undefined)
      assert.ok(!result.content.includes('/assets/js/pages/'))
      assert.ok(!result.content.includes('/assets/css/coralite-inline-'))
    } finally {
      await cleanupTestProject()
    }
  })
})
