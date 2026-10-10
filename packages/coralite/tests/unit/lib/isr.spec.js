import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { createTestProject } from '../utils/project.js'
import { virtualPagePlugin } from '../utils/virtual-page-plugin.js'

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
    await project.writePage('interactive.html', '<dynamic-comp></dynamic-comp>')
    await project.writeComponent('dynamic-comp.html', `
      <template id="dynamic-comp"><div>Interactive</div></template>
      <script type="module">
        import { defineComponent } from 'coralite';
        export default defineComponent({ client() {} });
      </script>
    `)

    // Create coralite without output dir to only test manifest logic
    const coralite = await project.createCoralite({ output: undefined })

    const results1 = await coralite.build()
    assert.strictEqual(results1.length, 2)
    assert.strictEqual(results1[0].status, undefined)

    // Second build without changes
    const results2 = await coralite.build()
    assert.strictEqual(results2.length, 2)
    assert.strictEqual(results2.find(r => r.path.pathname.endsWith('pure-ssr.html') || r.path.pathname.endsWith('index.html')).status, 'skipped')
    assert.strictEqual(results2.find(r => r.path.pathname.endsWith('interactive.html')).status, 'skipped', 'Pages with client controllers should also be skipped when unchanged')
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
    const plugin = virtualPagePlugin('virtual.html', {
      content: '<h1>Virtual</h1>',
      cacheKey: 'v1'
    })

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
    const options = { content: '<h1>Virtual</h1>', cacheKey: 'v1' }
    const plugin = virtualPagePlugin('virtual.html', options)

    const coralite = await project.createCoralite({
      plugins: [plugin]
    })

    await coralite.build()

    // Change cacheKey
    options.cacheKey = 'v2'
    const results = await coralite.build()
    const virtualResult = results.find(r => r.path.pathname === 'virtual.html')
    assert.strictEqual(virtualResult.status, undefined)
  })

  it('should always rebuild volatile virtual pages', async () => {
    const plugin = virtualPagePlugin('volatile.html', {
      content: '<h1>Volatile</h1>',
      cacheKey: 'constant',
      volatile: true
    })

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

  it('should rebuild when testing.mocks configuration changes', async () => {
    await project.writePage('index.html', '<mocking-test></mocking-test>')
    await project.writeComponent('mocking-test.html', '<template id="mocking-test"><div>{{ data }}</div></template><script type="module">import { defineComponent } from \'coralite\'; export default defineComponent({ async server() { return { data: "REAL" } } })</script>')

    // 1. First build with mock-1
    const coralite1 = await project.createCoralite({
      output: undefined,
      mode: 'testing',
      testing: {
        mocks: {
          components: {
            'mocking-test': {
              server: async () => ({ data: 'MOCKED_1' })
            }
          }
        }
      }
    })

    const results1 = await coralite1.build()
    assert.strictEqual(results1.length, 1)
    assert.strictEqual(results1[0].status, undefined)
    assert.ok(results1[0].content.includes('MOCKED_1'))

    // 2. Second build with same mock configuration should be skipped
    const results2 = await coralite1.build()
    assert.strictEqual(results2.length, 1)
    assert.strictEqual(results2[0].status, 'skipped')

    // 3. Third build with changed mock configuration should rebuild
    const coralite2 = await project.createCoralite({
      output: undefined,
      mode: 'testing',
      testing: {
        mocks: {
          components: {
            'mocking-test': {
              server: async () => ({ data: 'MOCKED_2' })
            }
          }
        }
      }
    })

    const results3 = await coralite2.build()
    assert.strictEqual(results3.length, 1)
    assert.strictEqual(results3[0].status, undefined)
    assert.ok(results3[0].content.includes('MOCKED_2'))
  })

  it('should rebuild all pages without skipping when incremental is set to false in config', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')

    const coralite = await project.createCoralite({ output: undefined, incremental: false })

    const results1 = await coralite.build()
    assert.strictEqual(results1[0].status, undefined)

    // Second build with incremental: false should NOT skip
    const results2 = await coralite.build()
    assert.strictEqual(results2[0].status, undefined)
  })

  it('should allow overriding incremental: false per build call', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')

    const coralite = await project.createCoralite({ output: undefined, incremental: true })

    const results1 = await coralite.build()
    assert.strictEqual(results1[0].status, undefined)

    // Second build passing { incremental: false } to build() should NOT skip
    const results2 = await coralite.build(null, { incremental: false })
    assert.strictEqual(results2[0].status, undefined)
  })
})


describe('ISR asset invalidation', () => {
  let project

  beforeEach(async () => {
    project = await createTestProject()
    await mkdir(path.join(project.outputDir, 'assets/js'), { recursive: true })
    await writeFile(path.join(project.outputDir, 'assets/js/vendor.js'), 'console.log("v1");')
    await project.writePage('index.html', '<!DOCTYPE html><html><head></head><body><h1>Hello ISR</h1></body></html>')
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('changing injected asset forces page rebuild in incremental mode across 3 phases', async () => {
    // The asset source points INTO the output dir (simulating a bundler emitting
    // assets next to the rendered pages)
    const config = {
      mode: 'production',
      incremental: true,
      assets: [{
        dest: 'assets/js/vendor.js',
        src: path.join(project.outputDir, 'assets/js/vendor.js'),
        inject: {
          sri: true
        }
      }]
    }

    // 1st build (render)
    const app1 = await project.createCoralite(config)
    const results1 = await app1.save()
    assert.ok(results1.some(r => r.path.endsWith('index.html')))

    // Read saved manifest inside isolated tmpDir
    const manifestPath = path.join(project.testDir, '.coralite/manifest.json')
    const manifest1 = JSON.parse(await readFile(manifestPath, 'utf8'))
    const indexKey = Object.keys(manifest1.physical).find(k => k.endsWith('index.html'))
    assert.ok(indexKey)
    assert.ok(manifest1.physical[indexKey].injectedAssets)

    // 2nd build (unchanged asset) -> page should be skipped and retain injectedAssets in manifest
    const app2 = await project.createCoralite(config)
    const results2 = await app2.build()
    assert.equal(results2[0].status, 'skipped')

    const manifest2 = JSON.parse(await readFile(manifestPath, 'utf8'))
    assert.ok(manifest2.physical[indexKey].injectedAssets, 'skipped page must carry forward injectedAssets')

    // Modify vendor.js
    await writeFile(path.join(project.outputDir, 'assets/js/vendor.js'), 'console.log("v2 modified");')

    // 3rd build (changed asset) -> page should rebuild
    const app3 = await project.createCoralite(config)
    const results3 = await app3.build()
    assert.equal(results3[0].status, undefined)
  })
})