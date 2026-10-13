import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite, defineConfig, CoraliteError } from '#lib'

let TEST_DIR
let COMPONENTS_DIR
let PAGES_DIR
let OUTPUT_DIR

describe('Clean URLs Config (P2.08)', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-clean-urls-'))
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

  it('cleanUrls: true produces directory-style output paths and route.path without .html', async () => {
    await writeFile(
      join(PAGES_DIR, 'index.html'),
      '<!DOCTYPE html><html><body><h1>Home</h1></body></html>'
    )
    await writeFile(
      join(PAGES_DIR, 'about.html'),
      '<!DOCTYPE html><html><body><h1>About</h1></body></html>'
    )

    await mkdir(join(PAGES_DIR, 'posts'), { recursive: true })
    await writeFile(
      join(PAGES_DIR, 'posts', '[id].html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          paths () {
            return [{ id: 'intro' }]
          }
        })
      </script>
      <!DOCTYPE html><html><body><h1>Post</h1></body></html>`
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      cleanUrls: true,
      mode: 'production',
      incremental: false
    })

    const results = await app.save()
    const htmlResults = results.filter(r => r.path.endsWith('.html'))

    assert.equal(htmlResults.length, 3)

    // Root exception: dist/index.html with route.path '/'
    const indexResult = results.find(r => r.path.endsWith('index.html') && !r.path.includes('about') && !r.path.includes('posts'))
    assert.ok(indexResult, 'Root page must produce dist/index.html')

    const aboutHtmlExists = await readFile(join(OUTPUT_DIR, 'about', 'index.html'), 'utf8').catch(() => null)
    assert.ok(aboutHtmlExists, 'about.html must produce dist/about/index.html under cleanUrls: true')

    const postHtmlExists = await readFile(join(OUTPUT_DIR, 'posts', 'intro', 'index.html'), 'utf8').catch(() => null)
    assert.ok(postHtmlExists, 'posts/[id].html with intro must produce dist/posts/intro/index.html under cleanUrls: true')

    // Check route.path values
    const buildResults = await app.build()
    const indexBuild = buildResults.find(r => r.path.pathname.endsWith('index.html') && !r.path.pathname.includes('about') && !r.path.pathname.includes('posts'))
    const aboutBuild = buildResults.find(r => r.path.pathname.includes('about'))
    const postBuild = buildResults.find(r => r.path.pathname.includes('posts'))

    assert.equal(indexBuild.route.path, '/')
    assert.equal(aboutBuild.route.path, '/about')
    assert.equal(postBuild.route.path, '/posts/intro')
  })

  it('cleanUrls: false produces file-style output paths and route.path with .html (except root)', async () => {
    await writeFile(
      join(PAGES_DIR, 'index.html'),
      '<!DOCTYPE html><html><body><h1>Home</h1></body></html>'
    )
    await writeFile(
      join(PAGES_DIR, 'about.html'),
      '<!DOCTYPE html><html><body><h1>About</h1></body></html>'
    )

    await mkdir(join(PAGES_DIR, 'posts'), { recursive: true })
    await writeFile(
      join(PAGES_DIR, 'posts', '[id].html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          paths () {
            return [{ id: 'intro' }]
          }
        })
      </script>
      <!DOCTYPE html><html><body><h1>Post</h1></body></html>`
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      cleanUrls: false,
      mode: 'production',
      incremental: false
    })

    const results = await app.save()
    const htmlResults = results.filter(r => r.path.endsWith('.html'))

    assert.equal(htmlResults.length, 3)

    // Root exception: dist/index.html with route.path '/'
    const indexResult = results.find(r => r.path.endsWith('index.html'))
    assert.ok(indexResult, 'Root page must produce dist/index.html under cleanUrls: false')

    const aboutHtmlExists = await readFile(join(OUTPUT_DIR, 'about.html'), 'utf8').catch(() => null)
    assert.ok(aboutHtmlExists, 'about.html must produce dist/about.html under cleanUrls: false')

    const postHtmlExists = await readFile(join(OUTPUT_DIR, 'posts', 'intro.html'), 'utf8').catch(() => null)
    assert.ok(postHtmlExists, 'posts/[id].html with intro must produce dist/posts/intro.html under cleanUrls: false')

    // Check route.path values
    const buildResults = await app.build()
    const indexBuild = buildResults.find(r => r.path.pathname.endsWith('index.html'))
    const aboutBuild = buildResults.find(r => r.path.pathname.endsWith('about.html'))
    const postBuild = buildResults.find(r => r.path.pathname.endsWith('posts/intro.html'))

    assert.equal(indexBuild.route.path, '/')
    assert.equal(aboutBuild.route.path, '/about.html')
    assert.equal(postBuild.route.path, '/posts/intro.html')
  })

  it('default cleanUrls value is true', async () => {
    await writeFile(
      join(PAGES_DIR, 'about.html'),
      '<!DOCTYPE html><html><body><h1>About</h1></body></html>'
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    await app.save()

    const aboutHtmlExists = await readFile(join(OUTPUT_DIR, 'about', 'index.html'), 'utf8').catch(() => null)
    assert.ok(aboutHtmlExists, 'Default cleanUrls must be true and produce dist/about/index.html')

    const buildResults = await app.build()
    const aboutBuild = buildResults.find(r => r.path.pathname.includes('about'))
    assert.equal(aboutBuild.route.path, '/about')
  })

  it('non-boolean cleanUrls throws config validation error', () => {
    assert.throws(
      () => defineConfig({
        output: OUTPUT_DIR,
        components: COMPONENTS_DIR,
        pages: PAGES_DIR,
        cleanUrls: 'invalid'
      }),
      (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('cleanUrls'))
        assert.ok(err.message.includes('boolean'))
        return true
      }
    )
  })

  it('deprecated urlStyle option throws error naming cleanUrls', () => {
    assert.throws(
      () => defineConfig({
        output: OUTPUT_DIR,
        components: COMPONENTS_DIR,
        pages: PAGES_DIR,
        urlStyle: 'directory'
      }),
      (err) => {
        assert.ok(err instanceof CoraliteError)
        assert.ok(err.message.includes('urlStyle'))
        assert.ok(err.message.includes('cleanUrls'))
        return true
      }
    )
  })
})
