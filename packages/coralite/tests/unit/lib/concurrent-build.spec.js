import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { createCoralite } from '#lib'

const TEST_DIR = join(process.cwd(), 'tests', 'fixtures', 'concurrent-build-test')
const COMPONENTS_DIR = join(TEST_DIR, 'components')
const PAGES_DIR = join(TEST_DIR, 'pages')
const OUTPUT_DIR = join(TEST_DIR, 'dist')

describe('Concurrent Page Generation', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })

    await writeFile(
      join(COMPONENTS_DIR, 'card-item.html'),
      `<template id="card-item">
        <div class="card">
          <h3>{{ title }}</h3>
          <p>{{ description }}</p>
        </div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          attributes: { title: String, description: String }
        })
      </script>`
    )

    for (let i = 1; i <= 10; i++) {
      const pageNum = String(i).padStart(2, '0')
      await writeFile(
        join(PAGES_DIR, `page-${pageNum}.html`),
        `<!DOCTYPE html>
<html>
<head><title>Page ${pageNum}</title></head>
<body>
  <h1>Page ${pageNum} Header</h1>
  <card-item title="Card ${pageNum}" description="Description for page ${pageNum}"></card-item>
</body>
</html>`
      )
    }
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('serial equivalence: output under maxConcurrent: 4 matches maxConcurrent: 1 exactly', async () => {
    const coraliteSerial = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      incremental: false
    })

    const serialResults = await coraliteSerial.build({ maxConcurrent: 1 })
    await coraliteSerial.clearCache(true)

    const coraliteConcurrent = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      concurrency: 4,
      incremental: false
    })

    const concurrentResults = await coraliteConcurrent.build()
    await coraliteConcurrent.clearCache(true)

    assert.equal(serialResults.length, concurrentResults.length)

    const serialMap = new Map(serialResults.map(r => [r.path.pathname, r.content]))
    const concurrentMap = new Map(concurrentResults.map(r => [r.path.pathname, r.content]))

    for (const [path, content] of serialMap.entries()) {
      assert.ok(concurrentMap.has(path), `Missing page ${path} in concurrent build output`)
      assert.equal(concurrentMap.get(path), content, `Content mismatch for page ${path}`)
    }
  })

  it('preserves exact queue order in build results regardless of async completion timing', async () => {
    let delayCount = 0
    const delayPlugin = {
      name: 'async-delay-plugin',
      server: {
        async onBeforePageRender ({ page }) {
          const fn = page?.file?.filename || page?.file?.pathname || ''
          if (fn.includes('page-01')) {
            delayCount++
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }
      }
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      plugins: [delayPlugin],
      concurrency: 4,
      incremental: false
    })

    const results = await coralite.build()
    await coralite.clearCache(true)

    assert.equal(delayCount, 1)
    assert.equal(results.length, 10)

    for (let i = 0; i < results.length; i++) {
      const expectedNum = String(i + 1).padStart(2, '0')
      assert.ok(
        results[i].path.pathname.endsWith(`page-${expectedNum}.html`),
        `Result at index ${i} should be page-${expectedNum}.html, but got ${results[i].path.pathname}`
      )
    }
  })

  it('state isolation: mutations in onBeforePageRender do not leak across pages', async () => {
    const leakTrackingPlugin = {
      name: 'leak-tracking-plugin',
      server: {
        onBeforePageRender ({ state, page }) {
          if (state.leakedProp) {
            throw new Error(`Cross-page state leak detected on ${page.file.filename}: ${state.leakedProp}`)
          }
          if (page.file.filename.includes('page-01.html')) {
            state.leakedProp = 'mutated-by-page-1'
          }
        }
      }
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      plugins: [leakTrackingPlugin],
      concurrency: 4,
      incremental: false
    })

    const results = await coralite.build()
    await coralite.clearCache(true)

    assert.equal(results.length, 10)
  })

  it('handles fail-fast cancellation cleanly without unhandled rejections', async () => {
    let unhandledRejections = 0
    const rejectionHandler = () => { unhandledRejections++ }
    process.on('unhandledRejection', rejectionHandler)

    const failingPlugin = {
      name: 'failing-plugin',
      server: {
        async onBeforePageRender ({ page }) {
          if (page.file.filename.includes('page-03.html')) {
            throw new Error('Simulated worker rendering failure on page 3')
          }
        }
      }
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      plugins: [failingPlugin],
      concurrency: 4,
      incremental: false
    })

    await assert.rejects(
      async () => {
        await coralite.build()
      },
      (err) => {
        return err.message.includes('Simulated worker rendering failure on page 3')
      }
    )

    await coralite.clearCache(true)
    await new Promise(resolve => setTimeout(resolve, 100))

    process.removeListener('unhandledRejection', rejectionHandler)
    assert.equal(unhandledRejections, 0, 'Unhandled rejections were emitted during fail-fast abort')
  })

  it('session integrity: session properties are intact during onAfterPageRender and cleaned up after', async () => {
    const sessionChecks = []

    const sessionCheckPlugin = {
      name: 'session-check-plugin',
      server: {
        onAfterPageRender ({ session, result }) {
          sessionChecks.push({
            page: result.path.pathname,
            hasState: session.state !== null && typeof session.state === 'object',
            hasStyles: session.styles !== null && session.styles instanceof Map,
            hasScripts: session.scripts !== null && typeof session.scripts === 'object'
          })
        }
      }
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      plugins: [sessionCheckPlugin],
      concurrency: 4,
      incremental: false
    })

    const results = await coralite.build()
    await coralite.clearCache(true)

    assert.equal(results.length, 10)
    assert.equal(sessionChecks.length, 10)

    for (const check of sessionChecks) {
      assert.ok(check.hasState, `Session state was prematurely nulled on ${check.page}`)
      assert.ok(check.hasStyles, `Session styles were prematurely nulled on ${check.page}`)
      assert.ok(check.hasScripts, `Session scripts were prematurely nulled on ${check.page}`)
    }

    for (const result of results) {
      assert.equal(result.session.state, null, `Session state should be nulled after worker teardown on ${result.path.pathname}`)
      assert.equal(result.session.styles, null, `Session styles should be nulled after worker teardown on ${result.path.pathname}`)
      assert.equal(result.session.scripts, null, `Session scripts should be nulled after worker teardown on ${result.path.pathname}`)
    }
  })

  it('variables precedence: build variables override page-level state without leaking across pages', async () => {
    const pageSetPlugin = {
      name: 'pageset-plugin',
      server: {
        onPageSet ({ state }) {
          state.title = 'FROM-PAGESET'
          state.pageOnly = 'KEPT'
        }
      }
    }

    const capturedStates = []
    const capturePlugin = {
      name: 'capture-plugin',
      server: {
        onBeforePageRender ({ state, page }) {
          capturedStates.push({
            page: page.file.filename,
            title: state.title,
            pageOnly: state.pageOnly
          })
        }
      }
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      plugins: [pageSetPlugin, capturePlugin],
      concurrency: 4,
      incremental: false
    })

    await coralite.build(null, {
      variables: { title: 'FROM-VARIABLES' }
    })
    await coralite.clearCache(true)

    assert.equal(capturedStates.length, 10)
    for (const entry of capturedStates) {
      assert.equal(entry.title, 'FROM-VARIABLES', `Variables should override page state on ${entry.page}`)
      assert.equal(entry.pageOnly, 'KEPT', `Non-overridden page state should be preserved on ${entry.page}`)
    }
  })

  it('concurrency normalization: coerces non-integer concurrency cleanly', async () => {
    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      concurrency: 2.7,
      incremental: false
    })

    const results = await coralite.build(null, { maxConcurrent: 3.9 })
    await coralite.clearCache(true)
    assert.equal(results.length, 10)
  })

  it('external AbortSignal: handles already-aborted signal before build', async () => {
    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      concurrency: 4,
      incremental: false
    })

    const controller = new AbortController()
    controller.abort(new Error('Pre-aborted signal'))

    await assert.rejects(
      async () => {
        await coralite.build(null, { signal: controller.signal })
      },
      (err) => err.message.includes('Pre-aborted signal')
    )
    await coralite.clearCache(true)
  })

  it('external AbortSignal: cleanly cancels in-flight tasks when external signal fires', async () => {
    const controller = new AbortController()

    const abortingPlugin = {
      name: 'aborting-plugin',
      server: {
        async onBeforePageRender ({ page }) {
          if (page.file.filename.includes('page-02.html')) {
            controller.abort(new Error('Mid-flight aborted signal'))
          }
        }
      }
    }

    const coralite = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      plugins: [abortingPlugin],
      concurrency: 4,
      incremental: false
    })

    await assert.rejects(
      async () => {
        await coralite.build(null, { signal: controller.signal })
      },
      (err) => err.message.includes('Mid-flight aborted signal')
    )
    await coralite.clearCache(true)
  })
})
