import assert from 'node:assert/strict'
import { test, describe, beforeEach, afterEach } from 'node:test'
import { createCoralite } from '../../../lib/coralite.js'
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'

describe('ISR Assets Tracking & Manifest Invalidation', () => {
  const tmpDir = join(process.cwd(), 'tests/fixtures/.tmp-isr-assets')

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true })
    await mkdir(join(tmpDir, 'pages'), { recursive: true })
    await mkdir(join(tmpDir, 'components'), { recursive: true })
    await mkdir(join(tmpDir, 'dist'), { recursive: true })
    await mkdir(join(tmpDir, 'dist/assets/js'), { recursive: true })

    await writeFile(join(tmpDir, 'pages/index.html'), '<!DOCTYPE html><html><head></head><body><h1>Hello ISR</h1></body></html>')
    await writeFile(join(tmpDir, 'dist/assets/js/vendor.js'), 'console.log("v1");')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('changing injected asset forces page rebuild in incremental mode across 3 phases', async () => {
    const config = {
      projectRoot: tmpDir,
      components: join(tmpDir, 'components'),
      pages: join(tmpDir, 'pages'),
      output: join(tmpDir, 'dist'),
      mode: 'production',
      incremental: true,
      assets: [{
        dest: 'assets/js/vendor.js',
        src: join(tmpDir, 'dist/assets/js/vendor.js'),
        inject: {
          sri: true
        }
      }]
    }

    // 1st build (render)
    const app1 = await createCoralite(config)
    const results1 = await app1.save()
    assert.ok(results1.some(r => r.path.endsWith('index.html')))

    // Read saved manifest inside isolated tmpDir
    const manifestPath = join(tmpDir, '.coralite/manifest.json')
    const manifest1 = JSON.parse(await readFile(manifestPath, 'utf8'))
    const indexKey = Object.keys(manifest1.physical).find(k => k.endsWith('index.html'))
    assert.ok(indexKey)
    assert.ok(manifest1.physical[indexKey].injectedAssets)

    // 2nd build (unchanged asset) -> page should be skipped and retain injectedAssets in manifest
    const app2 = await createCoralite(config)
    const results2 = await app2.build()
    assert.equal(results2[0].status, 'skipped')

    const manifest2 = JSON.parse(await readFile(manifestPath, 'utf8'))
    assert.ok(manifest2.physical[indexKey].injectedAssets, 'skipped page must carry forward injectedAssets')

    // Modify vendor.js
    await writeFile(join(tmpDir, 'dist/assets/js/vendor.js'), 'console.log("v2 modified");')

    // 3rd build (changed asset) -> page should rebuild
    const app3 = await createCoralite(config)
    const results3 = await app3.build()
    assert.equal(results3[0].status, undefined)
  })
})
