import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { writeFile, readFile } from 'node:fs/promises'
import { createTestProject } from '../utils/project.js'

describe('Incremental Static Regeneration (ISR)', () => {
  let project
  let cacheDir

  beforeEach(async () => {
    project = await createTestProject()
    cacheDir = path.join(project.testDir, '.coralite')
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('should skip rendering unchanged files on subsequent builds', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')

    // Create coralite without output dir to only test manifest logic
    const coralite = await project.createCoralite({ output: undefined })

    const results1 = await coralite.build()
    assert.strictEqual(results1.length, 1)
    assert.strictEqual(results1[0].status, undefined)

    // Second build without changes
    const results2 = await coralite.build()
    assert.strictEqual(results2.length, 1)
    assert.strictEqual(results2[0].status, 'skipped')
  })

  it('should rebuild when a file content changes', async () => {
    const pagePath = await project.writePage('index.html', '<h1>Home</h1>')

    const coralite = await project.createCoralite()

    await coralite.build()

    // Change file
    await writeFile(pagePath, '<h1>Home Updated</h1>')
    const results = await coralite.build()

    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].status, undefined)
    assert.ok(results[0].content.includes('Home Updated'))
  })

  it('should rebuild dependent pages when a component changes', async () => {
    await project.writePage('index.html', '<my-comp></my-comp>')
    await project.writeComponent('my-comp.html', '<template id="my-comp"><div>Original</div></template>')

    const coralite = await project.createCoralite()

    // First build to establish dependencies
    await coralite.build()

    // Change component
    await project.writeComponent('my-comp.html', '<template id="my-comp"><div>Updated</div></template>')

    const results = await coralite.build()
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].status, undefined)
    assert.ok(results[0].content.includes('Updated'))
  })

  it('should handle virtual pages with cacheKey', async () => {
    const plugin = {
      name: 'virtual-page-plugin',
      server: {
        onBeforeBuild: async ({
          app,
          buildId
        }) => {
          await app.addRenderQueue({
            pathname: 'virtual.html',
            content: '<h1>Virtual</h1>',
            cacheKey: 'v1'
          }, buildId)
        }
      }
    }

    const coralite = await project.createCoralite({
      plugins: [plugin],
      output: undefined
    })

    const results1 = await coralite.build()
    const virtualResult1 = results1.find(r => r.path.pathname === 'virtual.html')
    assert.ok(virtualResult1)
    assert.strictEqual(virtualResult1.status, undefined)

    // Second build with same cacheKey
    const results2 = await coralite.build()
    const virtualResult2 = results2.find(r => r.path.pathname === 'virtual.html')
    assert.strictEqual(virtualResult2.status, 'skipped')
  })

  it('should rebuild virtual pages when cacheKey changes', async () => {
    let cacheKey = 'v1'
    const plugin = {
      name: 'virtual-page-plugin',
      server: {
        onBeforeBuild: async ({
          app,
          buildId
        }) => {
          await app.addRenderQueue({
            pathname: 'virtual.html',
            content: '<h1>Virtual</h1>',
            cacheKey
          }, buildId)
        }
      }
    }

    const coralite = await project.createCoralite({
      plugins: [plugin]
    })

    await coralite.build()

    // Change cacheKey
    cacheKey = 'v2'
    const results = await coralite.build()
    const virtualResult = results.find(r => r.path.pathname === 'virtual.html')
    assert.strictEqual(virtualResult.status, undefined)
  })

  it('should always rebuild volatile virtual pages', async () => {
    const plugin = {
      name: 'volatile-page-plugin',
      server: {
        onBeforeBuild: async ({
          app,
          buildId
        }) => {
          await app.addRenderQueue({
            pathname: 'volatile.html',
            content: '<h1>Volatile</h1>',
            cacheKey: 'constant',
            volatile: true
          }, buildId)
        }
      }
    }

    const coralite = await project.createCoralite({
      plugins: [plugin]
    })

    await coralite.build()

    const results = await coralite.build()
    const volatileResult = results.find(r => r.path.pathname === 'volatile.html')
    assert.strictEqual(volatileResult.status, undefined)
  })

  it('should not save skipped pages to disk', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')

    const coralite = await project.createCoralite()

    // First build and save
    await coralite.save()
    const outputFilePath = path.join(project.outputDir, 'index.html')
    await readFile(outputFilePath, 'utf8')

    // Modify the output file manually to see if it gets overwritten
    await writeFile(outputFilePath, 'Manually Modified')

    // Second build and save (should be skipped)
    await coralite.save()

    const finalStats = await readFile(outputFilePath, 'utf8')
    assert.strictEqual(finalStats, 'Manually Modified', 'Skipped page should not have overwritten the file')
  })

  it('should handle cold start (missing .coralite directory)', async () => {
    await project.writePage('index.html', '<h1>Cold Start</h1>')

    const coralite = await project.createCoralite()

    const results = await coralite.build()
    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].status, undefined)

    // Verify manifest was created
    const manifestExists = await import('node:fs').then(fs => fs.existsSync(path.join(cacheDir, 'manifest.json')))
    assert.ok(manifestExists, 'Manifest should be created on cold start')
  })

  it('should halt build if onBeforeBuild fails', async () => {
    const errorPlugin = {
      name: 'error-plugin',
      server: {
        onBeforeBuild: async () => {
          throw new Error('API Failure')
        }
      }
    }

    const coralite = await project.createCoralite({
      plugins: [errorPlugin],
      onError: () => {
      }
    })

    try {
      await coralite.build()
      assert.fail('Build should have thrown')
    } catch (err) {
      assert.ok(err.message.includes('Error in onBeforeBuild hook'), 'Error should be descriptive')
      assert.ok(err.message.includes('API Failure'))
    }
  })
})
