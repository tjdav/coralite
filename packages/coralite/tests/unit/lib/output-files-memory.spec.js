import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib/coralite.js'

describe('outputFiles & Asset Cache Memory Management', () => {
  let testDir
  let pagesDir
  let componentsDir
  let distDir

  beforeEach(async () => {
    testDir = join(tmpdir(), `coralite-mem-test-${Math.random().toString(36).slice(2)}`)
    pagesDir = join(testDir, 'pages')
    componentsDir = join(testDir, 'components')
    distDir = join(testDir, 'dist')

    await mkdir(pagesDir, { recursive: true })
    await mkdir(componentsDir, { recursive: true })
    await mkdir(distDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('purges outputFiles across rebuilds in testing/production mode', async () => {
    await writeFile(
      join(componentsDir, 'my-comp.html'),
      `<template id="my-comp"><div>Hello <slot></slot></div></template>
       <script type="module">
         import { defineComponent } from 'coralite'
         export default defineComponent({
           client () {
             console.log('client')
           }
         })
       </script>`
    )
    await writeFile(
      join(pagesDir, 'page-a.html'),
      `<!DOCTYPE html><html><body><my-comp>Page A</my-comp></body></html>`
    )
    await writeFile(
      join(pagesDir, 'page-b.html'),
      `<!DOCTYPE html><html><body><my-comp>Page B</my-comp></body></html>`
    )

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      output: distDir,
      mode: 'testing',
      csp: { enabled: true, externalScripts: true }
    })

    // Build Page A
    await app.build('page-a.html')
    const keysA = Object.keys(app.outputFiles)
    const pageAScript = keysA.find(k => k.includes('pages/page-a-'))
    assert.ok(pageAScript, 'outputFiles should contain page-a script')

    // Build Page B
    await app.build('page-b.html')
    const keysB = Object.keys(app.outputFiles)
    const pageBScript = keysB.find(k => k.includes('pages/page-b-'))
    assert.ok(pageBScript, 'outputFiles should contain page-b script')
    assert.strictEqual(
      keysB.includes(pageAScript),
      false,
      'outputFiles should NOT contain stale page-a script from previous build'
    )
    await app.clearCache(true)
  })

  it('preserves component bundles in dev mode across single page builds', async () => {
    await writeFile(
      join(componentsDir, 'my-card.html'),
      `<template id="my-card"><div class="card"><slot></slot></div></template>
       <script type="module">
         import { defineComponent } from 'coralite'
         export default defineComponent({
           client () {
             console.log('card mounted')
           }
         })
       </script>`
    )
    await writeFile(
      join(pagesDir, 'index.html'),
      `<!DOCTYPE html><html><body><my-card>Card 1</my-card></body></html>`
    )
    await writeFile(
      join(pagesDir, 'about.html'),
      `<!DOCTYPE html><html><body><my-card>Card 2</my-card></body></html>`
    )

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      output: distDir,
      mode: 'development',
      csp: { enabled: true, externalScripts: true }
    })

    await app.build('index.html')
    assert.ok(app.outputFiles['manifest.js'], 'manifest.js should exist')
    const devKeys1 = Object.keys(app.outputFiles)
    const indexScript = devKeys1.find(k => k.includes('pages/index-'))
    assert.ok(indexScript, 'index.html script should be present')

    await app.build('about.html')
    assert.ok(app.outputFiles['manifest.js'], 'manifest.js should still exist after second build')
    const devKeys2 = Object.keys(app.outputFiles)
    const aboutScript = devKeys2.find(k => k.includes('pages/about-'))
    assert.ok(aboutScript, 'about.html script should be present')
    assert.strictEqual(
      devKeys2.includes(indexScript),
      false,
      'index.html script should be purged on subsequent build'
    )
    await app.clearCache(true)
  })

  it('keeps outputFiles strictly bounded across 10 successive builds', async () => {
    await writeFile(
      join(componentsDir, 'counter-elem.html'),
      `<template id="counter-elem"><button>Count</button></template>`
    )

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      output: distDir,
      mode: 'testing',
      csp: { enabled: true, externalScripts: true }
    })

    for (let i = 0; i < 10; i++) {
      await writeFile(
        join(pagesDir, 'dynamic.html'),
        `<!DOCTYPE html><html><body><counter-elem></counter-elem><div>Run ${i}</div></body></html>`
      )
      await app.build('dynamic.html')
      const fileCount = Object.keys(app.outputFiles).length
      // Should contain manifest.js, coralite runtime, and single page script
      assert.ok(fileCount <= 5, `outputFiles length (${fileCount}) should remain bounded`)
    }
    await app.clearCache(true)
  })

  it('clears outputFiles and trackedOutputFiles on app.save() and app.clearCache()', async () => {
    await writeFile(
      join(componentsDir, 'simple-box.html'),
      `<template id="simple-box"><div>Simple</div></template>`
    )
    await writeFile(
      join(pagesDir, 'index.html'),
      `<!DOCTYPE html><html><body><simple-box></simple-box></body></html>`
    )

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      output: distDir,
      mode: 'production',
      csp: { enabled: true, externalScripts: true }
    })

    await app.writeFile('test.txt', 'hello')
    assert.ok(app.getTrackedOutputFiles().length > 0, 'trackedOutputFiles should contain test.txt')

    await app.save()
    assert.strictEqual(Object.keys(app.outputFiles).length, 0, 'outputFiles should be empty after save()')
    assert.strictEqual(app.getTrackedOutputFiles().length, 0, 'trackedOutputFiles should be cleared after save()')

    await app.build('index.html')
    assert.ok(Object.keys(app.outputFiles).length > 0, 'outputFiles should be re-populated on build()')
    await app.clearCache(true)
  })

  it('guards active builds against concurrency hazards', async () => {
    await writeFile(
      join(componentsDir, 'async-comp.html'),
      `<template id="async-comp"><div>Async</div></template>`
    )
    await writeFile(
      join(pagesDir, 'page1.html'),
      `<!DOCTYPE html><html><body><async-comp></async-comp></body></html>`
    )
    await writeFile(
      join(pagesDir, 'page2.html'),
      `<!DOCTYPE html><html><body><async-comp></async-comp></body></html>`
    )

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      output: distDir,
      mode: 'testing',
      csp: { enabled: true, externalScripts: true }
    })

    const p1 = app.build('page1.html')
    const p2 = app.build('page2.html')

    await Promise.all([p1, p2])
    assert.ok(Object.keys(app.outputFiles).length > 0, 'outputFiles should be populated after concurrent builds')
    await app.clearCache(true)
  })

  it('bounds SRI cache entries on repeated asset edits', async () => {
    const assetPath = join(distDir, 'custom.js')
    await writeFile(assetPath, 'console.log(1)')

    await writeFile(
      join(pagesDir, 'sri-page.html'),
      `<!DOCTYPE html><html><head></head><body>Hello</body></html>`
    )

    const app = await createCoralite({
      pages: pagesDir,
      components: componentsDir,
      output: distDir,
      mode: 'testing',
      assets: [
        {
          src: assetPath,
          dest: 'custom.js',
          inject: { sri: 'sha384', placement: 'head-end' }
        }
      ]
    })

    const { calculateSRIDigest } = await import('../../../lib/utils/server/csp.js')

    for (let i = 0; i < 5; i++) {
      const content = `console.log(${i})`
      await writeFile(assetPath, content)
      const now = new Date(Date.now() + i * 1000)
      const { utimes } = await import('node:fs/promises')
      await utimes(assetPath, now, now)
      const results = await app.build('sri-page.html')

      const page = results.find(r => r.path.filename === 'sri-page.html')
      assert.ok(page, 'sri-page.html should be rendered')
      const expectedDigest = calculateSRIDigest(Buffer.from(content), 'sha384')
      assert.ok(
        page.content.includes(`integrity="${expectedDigest}"`),
        `Rendered integrity attribute must match the current asset content (iteration ${i})`
      )
    }

    await app.clearCache(true)
  })
})
