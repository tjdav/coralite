import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { createCoralite, defineConfig } from '../../../../lib/index.js'
import { resolveSource } from '../../../../lib/cli/server.js'

describe('fixtures and pages test isolation', () => {
  let tmpDir
  let pagesDir
  let compDir
  let fixturesDir
  let outDir
  let apps = []

  beforeEach(async () => {
    apps = []
    tmpDir = await mkdtemp(join(tmpdir(), 'coralite-fixtures-spec-'))
    pagesDir = join(tmpDir, 'src', 'pages')
    compDir = join(tmpDir, 'src', 'components')
    fixturesDir = join(tmpDir, 'tests', 'fixtures')
    outDir = join(tmpDir, 'dist')

    await mkdir(pagesDir, { recursive: true })
    await mkdir(compDir, { recursive: true })
    await mkdir(fixturesDir, { recursive: true })
  })

  afterEach(async () => {
    for (const app of apps) {
      if (app && typeof app.clearCache === 'function') {
        await app.clearCache(true)
      }
    }
    apps = []
    await rm(tmpDir, {
      recursive: true,
      force: true
    })
  })

  it('excludes __test__ directories and *.test.html files from production pages build', async () => {
    // Normal page
    await writeFile(join(pagesDir, 'index.html'), '<template id="page-index"><h1>Home</h1></template>')

    // Test directory inside pages (legacy pollution)
    const testDirInPages = join(pagesDir, '__test__')
    await mkdir(testDirInPages, { recursive: true })
    await writeFile(join(testDirInPages, 'legacy-test.html'), '<template id="page-test"><h1>Test</h1></template>')

    // Test file inside pages
    await writeFile(join(pagesDir, 'about.test.html'), '<template id="page-about-test"><h1>About Test</h1></template>')

    const config = defineConfig({
      output: outDir,
      components: compDir,
      pages: pagesDir,
      mode: 'production'
    })

    const app = await createCoralite(config)
    apps.push(app)
    assert.strictEqual(app.pages.list.length, 1)
    assert.strictEqual(app.pages.list[0].path.filename, 'index.html')

    const buildResults = await app.build()
    assert.strictEqual(buildResults.length, 1)
    assert.strictEqual(buildResults[0].path.filename, 'index.html')
  })

  it('excludes __test__ directories and *.test.html / *.fixture.html files from production components', async () => {
    // Normal component
    await writeFile(join(compDir, 'real-button.html'), `
<template id="real-button"><button><slot></slot></button></template>
<script type="module">export const attributes = {}</script>
`)

    // Test directory inside components
    const testDirInComp = join(compDir, '__test__')
    await mkdir(testDirInComp, { recursive: true })
    await writeFile(join(testDirInComp, 'mock-button.html'), `
<template id="mock-button"><button>Mock</button></template>
<script type="module">export const attributes = {}</script>
`)

    // Test and fixture files directly in components
    await writeFile(join(compDir, 'button.test.html'), `
<template id="button-test"><div>Test</div></template>
<script type="module">export const attributes = {}</script>
`)
    await writeFile(join(compDir, 'button.fixture.html'), `
<template id="button-fixture"><div>Fixture</div></template>
<script type="module">export const attributes = {}</script>
`)

    await writeFile(join(pagesDir, 'index.html'), '<template id="page-index"><h1>Home</h1></template>')

    const config = defineConfig({
      output: outDir,
      components: compDir,
      pages: pagesDir,
      mode: 'production'
    })

    const app = await createCoralite(config)
    apps.push(app)

    const userCompIds = app.components.list
      .filter(c => c.path.pathname.startsWith(compDir))
      .map(c => c.result?.id)

    assert.ok(userCompIds.includes('real-button'), 'Real component is registered in production')
    assert.ok(!userCompIds.includes('mock-button'), 'Component in __test__ is excluded in production')
    assert.ok(!userCompIds.includes('button-test'), 'Component named *.test.html is excluded in production')
    assert.ok(!userCompIds.includes('button-fixture'), 'Component named *.fixture.html is excluded in production')
    assert.strictEqual(userCompIds.length, 1)
  })

  it('loads fixtures into app.fixtures and registers fixture components in development mode', async () => {
    // Create an app component
    await writeFile(join(compDir, 'app-card.html'), `
<template id="app-card">
  <div class="card"><slot></slot></div>
</template>
<script type="module">
  export const attributes = {}
</script>
`)

    // Create a fixture component
    const fixtureCompDir = join(fixturesDir, 'components')
    await mkdir(fixtureCompDir, { recursive: true })
    await writeFile(join(fixtureCompDir, 'mock-helper.html'), `
<template id="mock-helper">
  <div class="mock">Helper</div>
</template>
<script type="module">
  export const attributes = {}
</script>
`)

    // Create a fixture page that uses both the app component and mock helper
    const fixturePageDir = join(fixturesDir, 'pages')
    await mkdir(fixturePageDir, { recursive: true })
    const fixturePagePath = join(fixturePageDir, 'card-fixture.html')
    await writeFile(fixturePagePath, `
<template id="card-fixture">
  <app-card>
    <mock-helper></mock-helper>
  </app-card>
</template>
`)

    // Standard page
    await writeFile(join(pagesDir, 'index.html'), '<template id="index"><h1>Home</h1></template>')

    const config = defineConfig({
      output: outDir,
      components: compDir,
      pages: pagesDir,
      fixtures: {
        pages: fixturePageDir,
        components: fixtureCompDir,
        prefix: '/__fixtures__'
      },
      mode: 'development'
    })

    const app = await createCoralite(config)
    apps.push(app)

    // Production pages collection contains only real pages
    assert.strictEqual(app.pages.list.length, 1)
    assert.strictEqual(app.pages.list[0].path.filename, 'index.html')

    // Fixtures collection contains the fixture page
    assert.ok(app.fixtures)
    assert.strictEqual(app.fixtures.list.length, 1)
    assert.strictEqual(app.fixtures.list[0].path.filename, 'card-fixture.html')

    // App components list has both app-card and mock-helper
    const compIds = app.components.list.map(c => c.result?.id)
    assert.ok(compIds.includes('app-card'))
    assert.ok(compIds.includes('mock-helper'))

    // Build the fixture page explicitly
    const results = await app.build(fixturePagePath)
    assert.strictEqual(results.length, 1)
    assert.ok(results[0].content.includes('class="card"'))
    assert.ok(results[0].content.includes('class="mock"'))
  })

  it('resolves fixture URLs via resolveSource in dev server', async () => {
    const fixturePath = join(fixturesDir, 'button-fixture.html')
    await writeFile(fixturePath, '<template id="button-fixture"><button>Click</button></template>')
    await writeFile(join(pagesDir, 'index.html'), '<template id="index"><h1>Home</h1></template>')

    const config = defineConfig({
      output: outDir,
      components: compDir,
      pages: pagesDir,
      fixtures: fixturesDir,
      mode: 'development'
    })

    const app = await createCoralite(config)
    apps.push(app)
    const memorySource = new Map()

    const resolved = await resolveSource('/__fixtures__/button-fixture', '', config, app, memorySource)
    assert.ok(resolved)
    assert.strictEqual(resolved.pathname, fixturePath)
    assert.strictEqual(resolved.isFixture, true)
  })
})
