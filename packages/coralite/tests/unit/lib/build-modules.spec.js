import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { Coralite } from '#lib'

describe('Coralite Build Modes', () => {
  let testDir
  let pagesDir
  let templatesDir
  let coralite

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-mode-'))
    pagesDir = path.join(testDir, 'pages')
    templatesDir = path.join(testDir, 'templates')

    await mkdir(pagesDir, { recursive: true })
    await mkdir(templatesDir, { recursive: true })

    // Create a basic page
    await writeFile(path.join(pagesDir, 'index.html'), `
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <my-component></my-component>
        </body>
      </html>
    `)

    // Create a component with a script that exports a default
    // We export a simple string message to verify execution
    await writeFile(path.join(templatesDir, 'my-component.html'), `
      <template id="my-component">
        <div>{{ message }}</div>
        <script>
          export default {
            message: 'Hello from Component'
          }
        </script>
      </template>
    `)
  })

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('should build in production mode by default (esbuild strategy)', async () => {
    coralite = new Coralite({
      pages: pagesDir,
      templates: templatesDir
    })

    await coralite.initialise()
    const results = await coralite.build()

    assert.strictEqual(results.length, 1)
    const html = results[0].html
    assert.ok(html.includes('Hello from Component'), 'Output HTML should contain component message')
  })

  it('should build in development mode with SourceTextModule if available', async () => {
    // Check if SourceTextModule is available
    let SourceTextModule
    try {
      const vm = await import('node:vm')
      SourceTextModule = vm.SourceTextModule
    } catch (e) {
    }

    if (!SourceTextModule) {
      console.log('Skipping development mode test: SourceTextModule not available (needs --experimental-vm-modules)')
      return
    }

    coralite = new Coralite({
      pages: pagesDir,
      templates: templatesDir,
      mode: 'development'
    })

    await coralite.initialise()
    const results = await coralite.build()

    assert.strictEqual(results.length, 1)
    const html = results[0].html
    assert.ok(html.includes('Hello from Component'), 'Output HTML should contain component message')
  })
})
