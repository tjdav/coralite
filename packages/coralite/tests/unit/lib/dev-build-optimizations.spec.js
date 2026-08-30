import { describe, it } from 'node:test'
import assert from 'node:assert'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { createTestProject } from '../utils/project.js'

describe('Dev Build Pipeline Optimizations', () => {
  it('scopes render queue when buildPath is specified, ignoring unrequested virtual pages from plugins', async () => {
    const project = await createTestProject()

    await project.writePage('index.html', '<!DOCTYPE html><html><body><h1>Home Page</h1></body></html>')
    await project.writePage('about.html', '<!DOCTYPE html><html><body><h1>About Page</h1></body></html>')

    const aggregationPlugin = {
      name: 'test-aggregation',
      async onBeforeBuild ({ addRenderQueue }) {
        for (let i = 1; i <= 5; i++) {
          await addRenderQueue({
            pathname: path.join(project.pagesDir, `virtual-${i}.html`),
            content: `<!DOCTYPE html><html><body><h1>Virtual ${i}</h1></body></html>`
          })
        }
      }
    }

    const app = await project.createCoralite({
      plugins: [aggregationPlugin],
      mode: 'development'
    })

    try {
      const targetPath = path.join(project.pagesDir, 'index.html')
      const results = await app.build(targetPath)

      assert.strictEqual(results.length, 1, 'Build should only render the requested target page')
      assert.strictEqual(results[0].path.pathname, targetPath, 'Result should match requested buildPath')
    } finally {
      await project.cleanup()
    }
  })

  it('does not re-parse in-memory components on cold-start build without manifest', async () => {
    const project = await createTestProject()

    const compPath = await project.writeComponent('my-card.html', '<template id="my-card"><div><slot></slot></div></template>')
    await project.writePage('index.html', '<!DOCTYPE html><html><body><my-card>Hello</my-card></body></html>')

    const app = await project.createCoralite({
      mode: 'development'
    })

    let updateItemCalled = false
    const origUpdateItem = app.components.updateItem.bind(app.components)
    app.components.updateItem = async (...args) => {
      updateItemCalled = true
      return origUpdateItem(...args)
    }

    try {
      const results = await app.build(path.join(project.pagesDir, 'index.html'))
      assert.strictEqual(results.length, 1)

      assert.strictEqual(updateItemCalled, false, 'app.components.updateItem should not be called for pre-loaded components on cold start')

      const manifestPath = path.join(project.testDir, '.coralite', 'manifest.json')
      const manifestContent = JSON.parse(await readFile(manifestPath, 'utf8'))
      assert.ok(manifestContent.physical[compPath], 'new manifest should contain metadata for component')
      assert.ok(manifestContent.physical[compPath].mtime > 0, 'metadata should contain mtime')
      assert.ok(manifestContent.physical[compPath].size > 0, 'metadata should contain size')
      assert.ok(manifestContent.physical[compPath].hash, 'metadata should contain hash')
    } finally {
      await project.cleanup()
    }
  })
})
