import assert from 'node:assert/strict'
import { test, describe, beforeEach, afterEach } from 'node:test'
import { createCoralite } from '../../../lib/coralite.js'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

describe('Asset Injection & SRI Flush Pass', () => {
  const tmpDir = join(process.cwd(), 'tests/fixtures/.tmp-asset-injection')

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true })
    await mkdir(join(tmpDir, 'pages'), { recursive: true })
    await mkdir(join(tmpDir, 'components'), { recursive: true })
    await mkdir(join(tmpDir, 'dist'), { recursive: true })
    await mkdir(join(tmpDir, 'dist/assets/js'), { recursive: true })

    await writeFile(join(tmpDir, 'pages/index.html'), '<!DOCTYPE html><html><head><title>Home</title></head><body><h1>Hello</h1></body></html>')
    await writeFile(join(tmpDir, 'pages/docs.html'), '<!DOCTYPE html><html><head><title>Docs</title></head><body><h1>Docs</h1></body></html>')
    await writeFile(join(tmpDir, 'dist/assets/js/vendor.js'), 'console.log("vendor code");')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('declarative asset injection & SRI placement ordering', async () => {
    const app = await createCoralite({
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      assets: [{
        dest: 'assets/js/vendor.js',
        src: join(tmpDir, 'dist/assets/js/vendor.js'),
        inject: {
          type: 'script',
          placement: 'body-end',
          sri: true
        }
      }]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path.filename === 'index.html')
    assert.ok(indexResult)

    const html = indexResult.content
    assert.ok(html.includes('src="/assets/js/vendor.js"'))
    assert.ok(html.includes('integrity="sha384-'))
    assert.ok(html.includes('crossorigin="anonymous"'))

    // Verify ordering: vendor.js appears before client runtime bootstrap module script
    const vendorIndex = html.indexOf('src="/assets/js/vendor.js"')
    const runtimeIndex = html.indexOf('coralite-runtime')
    if (runtimeIndex !== -1) {
      assert.ok(vendorIndex < runtimeIndex, 'vendor.js must precede framework client runtime bootstrap script')
    }
  })

  test('page glob matching (universal vs picomatch)', async () => {
    const app = await createCoralite({
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      assets: [{
        dest: 'assets/js/vendor.js',
        src: join(tmpDir, 'dist/assets/js/vendor.js'),
        inject: {
          type: 'script',
          pages: 'docs.html'
        }
      }]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path.filename === 'index.html')
    const docsResult = results.find(r => r.path.filename === 'docs.html')

    assert.ok(!indexResult.content.includes('vendor.js'))
    assert.ok(docsResult.content.includes('vendor.js'))
  })

  test('deduplication against pre-existing HTML AST', async () => {
    await writeFile(
      join(tmpDir, 'pages/index.html'),
      '<!DOCTYPE html><html><head><script src="/assets/js/vendor.js"></script></head><body><h1>Hello</h1></body></html>'
    )

    const app = await createCoralite({
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      assets: [{
        dest: 'assets/js/vendor.js',
        src: join(tmpDir, 'dist/assets/js/vendor.js'),
        inject: true
      }]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path.filename === 'index.html')

    const count = (indexResult.content.match(/\/assets\/js\/vendor\.js/g) || []).length
    assert.equal(count, 1)
  })

  test('session.injectTag programmatic injection', async () => {
    const app = await createCoralite({
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      plugins: [{
        name: 'test-plugin',
        server: {
          onBeforePageRender ({ session }) {
            session.injectTag({
              type: 'script',
              content: 'console.log("plugin injected");',
              placement: 'head-start'
            })
          }
        }
      }]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path.filename === 'index.html')
    assert.ok(indexResult.content.includes('console.log("plugin injected");'))
  })

  test('SRI and explicit integrity conflict warning', async () => {
    let warningTriggered = false
    const app = await createCoralite({
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      onError: (data) => {
        if (data.level === 'WARN' && data.message.includes('Explicit integrity attribute provided while sri option is enabled')) {
          warningTriggered = true
        }
      },
      assets: [{
        dest: 'assets/js/vendor.js',
        src: join(tmpDir, 'dist/assets/js/vendor.js'),
        inject: {
          type: 'script',
          sri: true,
          attributes: {
            integrity: 'sha384-handcrafted'
          }
        }
      }]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path.filename === 'index.html')
    assert.ok(warningTriggered)
    assert.ok(indexResult.content.includes('integrity="sha384-handcrafted"'))
    assert.ok(!indexResult.content.includes('crossorigin="anonymous"'))
  })

  test('meta tag injection does not create text child nodes', async () => {
    const app = await createCoralite({
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      plugins: [{
        name: 'meta-plugin',
        server: {
          onBeforePageRender ({ session }) {
            session.injectTag({
              type: 'meta',
              name: 'theme-color',
              content: '#336699',
              placement: 'head-start'
            })
          }
        }
      }]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path.filename === 'index.html')
    assert.ok(indexResult.content.includes('<meta name="theme-color" content="#336699">'))
    assert.ok(!indexResult.content.includes('#336699</meta>'))
  })

  test('missing SRI source file skips tag injection gracefully', async () => {
    let warningTriggered = false
    const app = await createCoralite({
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      onError: (data) => {
        if (data.level === 'WARN' && data.message.includes('Referenced asset file') && data.message.includes('not found on disk')) {
          warningTriggered = true
        }
      },
      assets: [{
        dest: 'assets/js/non-existent.js',
        src: join(tmpDir, 'dist/assets/js/non-existent.js'),
        inject: {
          type: 'script',
          sri: true
        }
      }]
    })

    const results = await app.build()
    const indexResult = results.find(r => r.path.filename === 'index.html')
    assert.ok(warningTriggered)
    assert.ok(!indexResult.content.includes('non-existent.js'))
  })
})
