
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

describe('Server Getters and Provide Context (isServer & signal)', () => {
  let projectDir
  let pagesDir
  let componentsDir

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'coralite-getters-provide-test-'))
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

  it('passes isServer: true and signal to component getters', async () => {
    await writeFile(
      join(componentsDir, 'test-getter-comp.html'),
      `<template id="test-getter-comp">
        <div id="out">{{ val }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          getters: {
            val: ({ isServer, signal }) => {
              const sigOk = signal && typeof signal.aborted === 'boolean' && !signal.aborted
              return \`isServer:\${isServer},signalOk:\${sigOk}\`
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
          <test-getter-comp></test-getter-comp>
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
    assert.ok(results[0].content.includes('isServer:true,signalOk:true'))
  })

  it('passes isServer: true and signal to page getters', async () => {
    await writeFile(
      join(pagesDir, 'page-getter.html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          getters: {
            pageVal: ({ isServer, signal }) => {
              const sigOk = signal && typeof signal.aborted === 'boolean' && !signal.aborted
              return \`pageIsServer:\${isServer},sigOk:\${sigOk}\`
            }
          }
        })
      </script>
      <!DOCTYPE html>
      <html>
        <body>
          <div>{{ pageVal }}</div>
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
    assert.ok(results[0].content.includes('pageIsServer:true,sigOk:true'))
  })

  it('passes isServer: true and signal to component provide functions', async () => {
    await writeFile(
      join(componentsDir, 'child-consumer.html'),
      `<template id="child-consumer">
        <div>{{ env }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          consume: {
            env: 'testEnv'
          }
        })
      </script>`
    )

    await writeFile(
      join(componentsDir, 'parent-provider.html'),
      `<template id="parent-provider">
        <child-consumer></child-consumer>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          provide: {
            testEnv: ({ isServer, signal }) => {
              const sigOk = signal && typeof signal.aborted === 'boolean' && !signal.aborted
              return \`provIsServer:\${isServer},sigOk:\${sigOk}\`
            }
          }
        })
      </script>`
    )

    await writeFile(
      join(pagesDir, 'test-provide.html'),
      `<!DOCTYPE html>
      <html>
        <body>
          <parent-provider></parent-provider>
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
    assert.ok(results[0].content.includes('provIsServer:true,sigOk:true'))
  })

  it('passes isServer: true and signal to page provide functions', async () => {
    await writeFile(
      join(componentsDir, 'page-child-consumer.html'),
      `<template id="page-child-consumer">
        <div>{{ env }}</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          consume: {
            env: 'pageEnv'
          }
        })
      </script>`
    )

    await writeFile(
      join(pagesDir, 'page-provide.html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          provide: {
            pageEnv: ({ isServer, signal }) => {
              const sigOk = signal && typeof signal.aborted === 'boolean' && !signal.aborted
              return \`pageProvIsServer:\${isServer},sigOk:\${sigOk}\`
            }
          }
        })
      </script>
      <!DOCTYPE html>
      <html>
        <body>
          <page-child-consumer></page-child-consumer>
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
    assert.ok(results[0].content.includes('pageProvIsServer:true,sigOk:true'))
  })
})
