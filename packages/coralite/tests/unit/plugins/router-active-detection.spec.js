import { describe, it } from 'node:test'
import assert from 'node:assert'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rm, writeFile, mkdir } from 'node:fs/promises'
import createCoralite from '../../../lib/server/create.js'
import { routerPlugin } from '../../../plugins/router.js'

describe('Router Active Detection (PERF-02b)', () => {
  it('router is active when explicitly passed in plugins', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/plugins/tmp-router-explicit-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    await writeFile(path.join(pagesDir, 'index.html'), '<html><body><h1>Hello</h1></body></html>', 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [routerPlugin()],
        mode: 'testing'
      })

      const results = await app.build()
      assert.ok(results.length > 0)
      assert.strictEqual(app._routerActiveCache, true)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('router is inactive for plain MPA app', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/plugins/tmp-router-inactive-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    await writeFile(path.join(pagesDir, 'index.html'), '<html><body><h1>Hello Plain</h1></body></html>', 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'testing'
      })

      const results = await app.build()
      assert.ok(results.length > 0)
      assert.strictEqual(app._routerActiveCache, false)

      // Verify body is not wrapped in router-outlet
      const pageResult = results[0]
      assert.ok(pageResult.content)
      assert.strictEqual(pageResult.content.includes('data-router-outlet'), false)
      assert.strictEqual(pageResult.content.includes('<router-outlet'), false)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('router is active when any component uses <router-outlet>', async () => {
    const app = await createCoralite({
      root: process.cwd(),
      components: fileURLToPath(new URL('../../fixtures/router-app/components', import.meta.url)),
      pages: fileURLToPath(new URL('../../fixtures/router-app/pages', import.meta.url)),
      plugins: [],
      mode: 'testing'
    })

    const results = await app.build()
    assert.ok(results.length > 0)
    assert.strictEqual(app._routerActiveCache, true)

    // Verify body is wrapped in router-outlet because component app-shell has data-router-outlet
    const pageResult = results[0]
    assert.ok(pageResult.content)
    assert.strictEqual(pageResult.content.includes('data-router-outlet'), true)
  })

  it('router is active when any component script references router', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/plugins/tmp-router-script-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    await writeFile(path.join(pagesDir, 'index.html'), '<html><body><router-user></router-user></body></html>', 'utf8')
    await writeFile(path.join(componentsDir, 'router-user.html'), '<template id="router-user"><div>User</div></template><script type="module">import { defineComponent } from "coralite"; export default defineComponent({ client({ router }) { router.navigate("/test") } })</script>', 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'testing'
      })

      const results = await app.build()
      assert.ok(results.length > 0)
      assert.strictEqual(app._routerActiveCache, true)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('explicit registration bypasses scan', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/plugins/tmp-router-bypass-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    await writeFile(path.join(pagesDir, 'index.html'), '<html><body><h1>Bypass Test</h1></body></html>', 'utf8')

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [routerPlugin()],
        mode: 'testing'
      })

      const results = await app.build()
      assert.ok(results.length > 0)
      assert.strictEqual(app._routerActiveCache, true)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('router remains inactive when pages mention router or data-router-outlet only in prose or code blocks', async () => {
    const tmpDir = path.resolve('packages/coralite/tests/unit/plugins/tmp-router-prose-test')
    const pagesDir = path.join(tmpDir, 'pages')
    const componentsDir = path.join(tmpDir, 'components')

    await rm(tmpDir, {
      recursive: true,
      force: true
    })
    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })

    await writeFile(
      path.join(pagesDir, 'index.html'),
      `<!DOCTYPE html>
      <html>
        <body>
          <p>Coralite includes an opt-in SPA router using data-router-outlet or &lt;router-outlet&gt;.</p>
          <pre><code>&lt;div data-router-outlet&gt;&lt;/div&gt;
          client({ router }) { router.navigate('/about') }</code></pre>
        </body>
      </html>`,
      'utf8'
    )

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [],
        mode: 'development'
      })

      const results = await app.build()
      await app.clearCache(true)
      assert.ok(results.length > 0)
      assert.strictEqual(app._routerActiveCache, false)
      assert.strictEqual(results[0].content.includes('<router-outlet'), false)
    } finally {
      await rm(tmpDir, {
        recursive: true,
        force: true
      })
    }
  })
})
