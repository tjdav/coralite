import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoralite } from '#lib'
import { createTestProject } from '../utils/project.js'

describe('Coralite Build Modes', () => {
  let project
  let coralite

  beforeEach(async () => {
    project = await createTestProject()

    // Create a basic page
    await project.writePage('index.html', `
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
    await project.writeComponent('my-component.html', `
      <template id="my-component">
        <div>{{ message }}</div>
        <script>
          export default {
            state: () => ({ message: 'Hello from Component' })
          }
        </script>
      </template>
    `)
  })

  afterEach(async () => {
    if (coralite) {
      await coralite.clearCache(true)
    }
    await project.cleanup()
  })

  it('should build in production mode by default (esbuild strategy)', async () => {
    coralite = await createCoralite({
      pages: project.pagesDir,
      components: project.componentsDir
    })

    const results = (await coralite.build()).filter(result => result.type === 'page')

    assert.strictEqual(results.length, 1)
    const html = results[0].content
    assert.ok(html.includes('Hello from Component'), 'Output HTML should contain component message')
  })

  it('should build in development mode with SourceTextModule if available', async () => {
    // Check if SourceTextModule is available
    let SourceTextModule
    try {
      const vm = await import('node:vm')
      SourceTextModule = vm.SourceTextModule
    } catch {
    }

    if (!SourceTextModule) {
      console.log('Skipping development mode test: SourceTextModule not available (needs --experimental-vm-modules)')
      return
    }

    coralite = await createCoralite({
      pages: project.pagesDir,
      components: project.componentsDir,
      mode: 'development'
    })

    const results = (await coralite.build()).filter(result => result.type === 'page')

    assert.strictEqual(results.length, 1)
    const html = results[0].content
    assert.ok(html.includes('Hello from Component'), 'Output HTML should contain component message')
  })
})
