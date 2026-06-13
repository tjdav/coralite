import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

describe('Incremental Static Regeneration (ISR)', () => {
  let testDir
  let pagesDir
  let componentDir
  let outputDir
  let cacheDir
  let coralite

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'coralite-isr-test-'))
    pagesDir = path.join(testDir, 'pages')
    componentDir = path.join(testDir, 'component')
    outputDir = path.join(testDir, 'dist')
    cacheDir = path.join(testDir, '.coralite')

    await mkdir(pagesDir)
    await mkdir(componentDir)
    await mkdir(outputDir)

    // Cleanup any existing .coralite manifest from previous runs if any
    await rm(cacheDir, {
      recursive: true,
      force: true
    })
  })

  afterEach(async () => {
    if (coralite) {
      await coralite.clearCache(true)
    }
    await rm(testDir, {
      recursive: true,
      force: true
    })
    await rm(cacheDir, {
      recursive: true,
      force: true
    })
  })

  it('should skip rendering unchanged files on subsequent builds', async () => {
    await writeFile(path.join(pagesDir, 'index.html'), '<h1>Home</h1>')

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      projectRoot: testDir
    })

    const results1 = await coralite.build()
    assert.strictEqual(results1.length, 1)
    assert.strictEqual(results1[0].status, undefined)

    // Second build without changes
    const results2 = await coralite.build()
    assert.strictEqual(results2.length, 1)
    assert.strictEqual(results2[0].status, 'skipped')
  })

  it('should rebuild when a file content changes', async () => {
    const pagePath = path.join(pagesDir, 'index.html')
    await writeFile(pagePath, '<h1>Home</h1>')

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      projectRoot: testDir
    })

    await coralite.build()

    // Change file
    await writeFile(pagePath, '<h1>Home Updated</h1>')
    const results = await coralite.build()

    assert.strictEqual(results.length, 1)
    assert.strictEqual(results[0].status, undefined)
    assert.ok(results[0].content.includes('Home Updated'))
  })

  it('should rebuild dependent pages when a component changes', async () => {
    await writeFile(path.join(pagesDir, 'index.html'), '<my-comp></my-comp>')
    await writeFile(path.join(componentDir, 'my-comp.html'), '<template id="my-comp"><div>Original</div></template>')

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      projectRoot: testDir
    })

    // First build to establish dependencies
    await coralite.build()

    // Change component
    await writeFile(path.join(componentDir, 'my-comp.html'), '<template id="my-comp"><div>Updated</div></template>')

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

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      plugins: [plugin],
      projectRoot: testDir
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

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      plugins: [plugin],
      projectRoot: testDir
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

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      plugins: [plugin],
      projectRoot: testDir
    })

    await coralite.build()

    const results = await coralite.build()
    const volatileResult = results.find(r => r.path.pathname === 'volatile.html')
    assert.strictEqual(volatileResult.status, undefined)
  })

  it('should not save skipped pages to disk', async () => {
    await writeFile(path.join(pagesDir, 'index.html'), '<h1>Home</h1>')

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      projectRoot: testDir
    })

    // First build and save
    await coralite.save()
    const outputFilePath = path.join(outputDir, 'index.html')
    await readFile(outputFilePath, 'utf8')

    // Modify the output file manually to see if it gets overwritten
    await writeFile(outputFilePath, 'Manually Modified')

    // Second build and save (should be skipped)
    await coralite.save()

    const finalStats = await readFile(outputFilePath, 'utf8')
    assert.strictEqual(finalStats, 'Manually Modified', 'Skipped page should not have overwritten the file')
  })

  it('should handle cold start (missing .coralite directory)', async () => {
    // Ensure cacheDir does not exist
    await rm(cacheDir, {
      recursive: true,
      force: true
    })

    await writeFile(path.join(pagesDir, 'index.html'), '<h1>Cold Start</h1>')

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      output: outputDir,
      projectRoot: testDir
    })

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

    coralite = await createCoralite({
      pages: pagesDir,
      components: componentDir,
      plugins: [errorPlugin],
      projectRoot: testDir,
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
