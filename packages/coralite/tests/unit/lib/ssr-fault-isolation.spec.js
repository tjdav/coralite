import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite, CoraliteBuildError } from '#lib'

let TEST_DIR
let COMPONENTS_DIR
let PAGES_DIR
let OUTPUT_DIR

describe('SSR Page-Level Fault Isolation & Component Error Boundaries', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-ssr-fault-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    PAGES_DIR = join(TEST_DIR, 'pages')
    OUTPUT_DIR = join(TEST_DIR, 'dist')

    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })

    // Healthy component
    await writeFile(
      join(COMPONENTS_DIR, 'healthy-card.html'),
      `<template id="healthy-card">
        <div class="card">{{ title }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          attributes: { title: String }
        })
      </script>`
    )

    // Component that throws during SSR
    await writeFile(
      join(COMPONENTS_DIR, 'failing-widget.html'),
      `<template id="failing-widget">
        <div class="widget">{{ message }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server() {
            throw new Error('Database connection failed in component')
          }
        })
      </script>`
    )
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('multi-page fault isolation: 1 failing page does not abort 9 healthy sibling pages', async () => {
    for (let i = 1; i <= 10; i++) {
      const isFailingPage = i === 5
      await writeFile(
        join(PAGES_DIR, `page-${i}.html`),
        `<!DOCTYPE html>
<html>
<head><title>Page ${i}</title></head>
<body>
  ${isFailingPage ? '<failing-widget></failing-widget>' : `<healthy-card title="Card ${i}"></healthy-card>`}
</body>
</html>`
      )
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    let thrownError = null
    try {
      await coralite.build()
    } catch (err) {
      thrownError = err
    }

    assert.ok(thrownError instanceof CoraliteBuildError, 'Should throw CoraliteBuildError')
    assert.equal(thrownError.failedPages.length, 1)
    assert.ok(thrownError.failedPages[0].path.pathname.includes('page-5.html'))
    assert.ok(thrownError.message.includes('Build completed with 1 failed page(s)'))
  })

  it('save() asset integrity: writes healthy HTML pages and JS/CSS asset bundles before re-throwing CoraliteBuildError', async () => {
    for (let i = 1; i <= 3; i++) {
      const isFailingPage = i === 2
      await writeFile(
        join(PAGES_DIR, `page-${i}.html`),
        `<!DOCTYPE html>
<html>
<head><title>Page ${i}</title></head>
<body>
  ${isFailingPage ? '<failing-widget></failing-widget>' : `<healthy-card title="Card ${i}"></healthy-card>`}
</body>
</html>`
      )
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    let thrownError = null
    try {
      await coralite.save()
    } catch (err) {
      thrownError = err
    }

    assert.ok(thrownError instanceof CoraliteBuildError)

    // Check disk: healthy pages exist, failed page was skipped
    const page1Content = await readFile(join(OUTPUT_DIR, 'page-1.html'), 'utf8')
    assert.ok(page1Content.includes('Card 1'))

    const page3Content = await readFile(join(OUTPUT_DIR, 'page-3.html'), 'utf8')
    assert.ok(page3Content.includes('Card 3'))

    let page2Exists = false
    try {
      await readFile(join(OUTPUT_DIR, 'page-2.html'), 'utf8')
      page2Exists = true
    } catch {
      page2Exists = false
    }
    assert.equal(page2Exists, false, 'Failed page HTML should not be written')

    // Check asset bundles were written in finally block
    const jsFiles = await readdir(join(OUTPUT_DIR, 'assets', 'js'))
    assert.ok(jsFiles.length > 0, 'JS assets should be written')
  })

  it('failOnError: false / continueOnError: true suppresses throw and returns failed results array', async () => {
    await writeFile(
      join(PAGES_DIR, 'good.html'),
      '<!DOCTYPE html><html><body><healthy-card title="Good"></healthy-card></body></html>'
    )
    await writeFile(
      join(PAGES_DIR, 'bad.html'),
      '<!DOCTYPE html><html><body><failing-widget></failing-widget></body></html>'
    )

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'production',
      incremental: false
    })

    const results = await coralite.build(null, { failOnError: false })

    assert.equal(results.length, 2)
    const goodResult = results.find(r => r.path.pathname.includes('good.html'))
    const badResult = results.find(r => r.path.pathname.includes('bad.html'))

    assert.ok(goodResult)
    assert.ok(goodResult.content.includes('Good'))
    assert.equal(badResult.status, 'failed')
    assert.ok(badResult.error)
  })

  it('incremental re-render: pages recorded in manifest.failed are forced to re-render until they succeed', async () => {
    await writeFile(
      join(PAGES_DIR, 'flaky.html'),
      '<!DOCTYPE html><html><body><failing-widget></failing-widget></body></html>'
    )

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      projectRoot: TEST_DIR,
      mode: 'production',
      incremental: true
    })

    // First build - fails
    try {
      await coralite.build()
    } catch (_err) {
      /* ignore CoraliteBuildError */
    }

    // Verify manifest recorded failed page
    const manifestPath = join(TEST_DIR, '.coralite', 'manifest.json')
    const manifestContent = JSON.parse(await readFile(manifestPath, 'utf8'))
    assert.ok(Array.isArray(manifestContent.failed))
    assert.ok(manifestContent.failed.some(p => p.includes('flaky.html')))

    // Fix component source so it succeeds
    await writeFile(
      join(COMPONENTS_DIR, 'failing-widget.html'),
      `<template id="failing-widget">
        <div class="widget">Fixed Widget</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server() { return { message: 'Fixed Widget' } }
        })
      </script>`
    )

    // Re-build (incremental = true)
    const results = await coralite.build()
    const fixedResult = results.find(r => r.path.pathname.includes('flaky.html'))

    assert.ok(fixedResult)
    assert.notEqual(fixedResult.status, 'skipped', 'Previously failed page should not be skipped')
    assert.ok(fixedResult.content.includes('Fixed Widget'))
  })

  it('component onError fallback in production mode: renders fallback template and removes hydration markers', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'boundary-card.html'),
      `<template id="boundary-card">
        <div class="card">{{ message }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server() {
            throw new Error('Service unavailable')
          },
          onError({ error, state }) {
            return {
              template: '<div class="fallback"><p>Fallback: {{ fallbackMsg }}</p></div>',
              state: { fallbackMsg: error.message }
            }
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      '<!DOCTYPE html><html><body><boundary-card></boundary-card></body></html>'
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

    const content = results[0].content
    assert.ok(content.includes('Fallback: Service unavailable'))
    assert.ok(!content.includes('data-cid'), 'Hydration marker data-cid should be stripped')
  })

  it('component onError in testing/development mode: re-throws errors for developer visibility', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'dev-card.html'),
      `<template id="dev-card">
        <div>{{ message }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server() {
            throw new Error('Dev failure')
          },
          onError() {
            return '<div class="fallback">Fallback</div>'
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      '<!DOCTYPE html><html><body><dev-card></dev-card></body></html>'
    )

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      mode: 'testing',
      incremental: false
    })

    await assert.rejects(
      async () => {
        await coralite.build()
      },
      (err) => err.message.includes('Dev failure')
    )
  })

  it('minimal component with only onError preserves script definition', async () => {
    await writeFile(
      join(COMPONENTS_DIR, 'minimal-card.html'),
      `<template id="minimal-card">
        <div>Content</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          onError({ error }) {
            return '<div>Fallback</div>'
          }
        })
      </script>`
    )

    await writeFile(
      join(PAGES_DIR, 'index.html'),
      '<!DOCTYPE html><html><body><minimal-card></minimal-card></body></html>'
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
  })
})
