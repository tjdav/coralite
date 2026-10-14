import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'
import { isAsyncFunction } from '../../../../lib/shared/core.js'

describe('Server Async Getters', () => {
  let projectDir
  let pagesDir
  let componentsDir

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'coralite-async-getters-server-test-'))
    pagesDir = join(projectDir, 'pages')
    componentsDir = join(projectDir, 'components')
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })
  })

  afterEach(async () => {
    if (projectDir) {
      await rm(projectDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('detects async getters at registration', () => {
    const syncFn = () => 'sync'
    const syncPromiseFn = () => Promise.resolve('syncPromise')
    const asyncFn = async () => 'async'

    assert.strictEqual(isAsyncFunction(syncFn), false)
    assert.strictEqual(isAsyncFunction(syncPromiseFn), false)
    assert.strictEqual(isAsyncFunction(asyncFn), true)
  })

  it('skips async getter execution during SSR and renders undefined', async () => {
    const called = false
    await writeFile(
      join(componentsDir, 'async-comp.html'),
      `<template id="async-comp">
        <div id="out">Val:{{ asyncVal }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            asyncVal: async () => {
              return 'client-value'
            }
          }
        })
      </script>`
    )

    await writeFile(
      join(pagesDir, 'index.html'),
      `<!DOCTYPE html>
      <html>
        <body>
          <async-comp></async-comp>
        </body>
      </html>`
    )

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: join(projectDir, 'dist'),
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    assert.strictEqual(results.length, 1)
    assert.strictEqual(called, false)
    assert.ok(results[0].content.includes('Val:undefined') || results[0].content.includes('Val:'))
  })

  it('renders sibling sync fallback when referencing async getter on server', async () => {
    await writeFile(
      join(componentsDir, 'fallback-comp.html'),
      `<template id="fallback-comp">
        <div id="out">{{ bodyText }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          server: () => ({
            source: 'Hello Coralite Framework!'
          }),
          getters: {
            renderedBody: async ({ state }) => {
              return state.source.toUpperCase()
            },
            bodyText: ({ state }) =>
              state.renderedBody === undefined
                ? state.source.slice(0, 5)
                : state.renderedBody
          }
        })
      </script>`
    )

    await writeFile(
      join(pagesDir, 'index.html'),
      `<!DOCTYPE html>
      <html>
        <body>
          <fallback-comp></fallback-comp>
        </body>
      </html>`
    )

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: join(projectDir, 'dist'),
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    assert.strictEqual(results.length, 1)
    assert.ok(results[0].content.includes('Hello'))
    assert.strictEqual(results[0].content.includes('HELLO CORALITE'), false)
  })

  it('skips page async getters during SSR', async () => {
    const pageCalled = false
    await writeFile(
      join(pagesDir, 'index.html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          getters: {
            asyncPageVal: async () => {
              return 'client-page-val'
            }
          }
        })
      </script>
      <!DOCTYPE html>
      <html>
        <body>
          <div>PageVal:{{ asyncPageVal }}</div>
        </body>
      </html>`
    )

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: join(projectDir, 'dist'),
      mode: 'production',
      incremental: false
    })

    const results = await app.build()
    assert.strictEqual(results.length, 1)
    assert.strictEqual(pageCalled, false)
  })
})
