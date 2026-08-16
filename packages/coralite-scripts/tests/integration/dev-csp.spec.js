import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import server, { buildLiveReloadScript, attachDevRoutes } from '../../libs/server.js'
import express from 'express'
import http from 'node:http'
import path from 'node:path'
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCLIProject } from '../utils/project.js'
import loadConfig from '../../libs/load-config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const coraliteScriptsLib = path.resolve(__dirname, '../../libs/config.js')
const libUrl = pathToFileURL(coraliteScriptsLib).href

describe('Dev Server Live-Reload CSP', () => {
  let project

  beforeEach(async () => {
    project = await createCLIProject()
  })

  afterEach(async () => {
    if (project) {
      await project.cleanup()
    }
  })

  it('formats rebuild script tag with external src and optional dev nonce', () => {
    const defaultTag = buildLiveReloadScript({})
    assert.equal(defaultTag.trim(), '<script src="/__coralite/rebuild.js"></script>\n</body>')

    const noncedTag = buildLiveReloadScript({ csp: { nonce: 'dev-nonce-123' } })
    assert.equal(noncedTag.trim(), '<script src="/__coralite/rebuild.js" nonce="dev-nonce-123"></script>\n</body>')
  })

  it('serves /__coralite/rebuild.js route via attachDevRoutes', async () => {
    const app = express()
    attachDevRoutes(app)

    const devServer = http.createServer(app)
    await new Promise((resolve) => devServer.listen(0, resolve))
    const address = devServer.address()
    // @ts-ignore
    const port = address.port

    try {
      const res = await fetch(`http://127.0.0.1:${port}/__coralite/rebuild.js`)
      assert.equal(res.status, 200)
      assert.ok(res.headers.get('content-type').startsWith('application/javascript'))
      const body = await res.text()
      assert.ok(body.includes("new EventSource('/__coralite/rebuild')"))
    } finally {
      await new Promise((resolve) => devServer.close(resolve))
    }
  })

  it('writes nested output script and external style files on page request in dev mode without ENOENT', async () => {
    await project.writeComponent('my-card.html', `
      <template id="my-card">
        <style>
          .card { color: red; }
        </style>
        <div class="card">Card</div>
      </template>
      <script type="module">
        import { defineComponent } from 'coralite'
        export default defineComponent({
          client ({ state }) {
            state.count = 0
          }
        })
      </script>
    `)

    await project.writePage('index.html', `
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <my-card></my-card>
        </body>
      </html>
    `)

    const testPort = 3890 + Math.floor(Math.random() * 1000)

    await project.writeConfig(`
      import { defineConfig } from '${libUrl}'
      export default defineConfig({
        output: './.coralite',
        components: './src/components',
        pages: './src/pages',
        public: './public',
        csp: {
          enabled: true,
          externalScripts: true,
          externalStyles: true
        },
        server: {
          port: ${testPort}
        }
      })
    `)

    const originalCwd = process.cwd()
    process.chdir(project.testDir)

    try {
      const config = await loadConfig(project.testDir)
      assert.ok(config, 'Config should load successfully')

      // Start dev server in 'test' mode
      const devServer = await server(config, { verbose: false }, 'test')

      let html = ''
      try {
        // Fetch page to trigger on-demand compilation and asset writing
        const res = await fetch(`http://127.0.0.1:${testPort}/`)
        assert.equal(res.status, 200, 'Request should succeed with status 200')
        html = await res.text()
      } finally {
        if (devServer) {
          await new Promise(resolve => devServer.close(resolve))
        }
      }

      assert.ok(html.includes('my-card'), 'Response contains page HTML')

      // Verify asset directories were created
      const outputDir = path.join(project.testDir, '.coralite')
      const jsAssetsDir = path.join(outputDir, 'assets', 'js')
      const cssAssetsDir = path.join(outputDir, 'assets', 'css')

      assert.ok(existsSync(jsAssetsDir), 'assets/js directory should exist')
      assert.ok(existsSync(cssAssetsDir), 'assets/css directory should exist')

      // Check for nested page script files under assets/js/pages or assets/js
      const jsFiles = await readdir(jsAssetsDir, { recursive: true })
      assert.ok(jsFiles.length > 0, 'JS assets should be written to assets/js')

      // Verify external CSS assets are in assets/css, not assets/js
      const cssFiles = await readdir(cssAssetsDir, { recursive: true })
      assert.ok(cssFiles.length > 0, 'CSS assets should be written to assets/css')
      const cssFileContent = await readFile(path.join(cssAssetsDir, cssFiles[0]), 'utf-8')
      assert.ok(cssFileContent.length > 0, 'CSS asset is not empty')
    } finally {
      process.chdir(originalCwd)
    }
  })
})
