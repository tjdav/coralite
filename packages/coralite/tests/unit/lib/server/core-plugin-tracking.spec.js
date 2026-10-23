import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'
import { listsPlugin } from '#plugins/lists'
import { definePlugin } from '../../../../lib/server/plugin/define.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../fixtures')
const componentsDir = join(fixturesDir, 'components')

let testDir
let pagesDir
let outputDir

describe('Core plugin tracking (PERF-02a)', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-perf02a-test-'))
    pagesDir = join(testDir, 'pages')
    outputDir = join(testDir, 'dist')
    await mkdir(pagesDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  it('marks auto-registered plugins with _isAutoCorePlugin', async () => {
    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      plugins: [],
      mode: 'testing'
    })

    const lists = app.options.plugins.find(p => p.name === 'lists')
    const router = app.options.plugins.find(p => p.name === 'router')

    assert.ok(lists, 'lists plugin should be registered')
    assert.ok(router, 'router plugin should be registered')
    assert.strictEqual(lists._isAutoCorePlugin, true)
    assert.strictEqual(router._isAutoCorePlugin, true)
  })

  it('explicitly-passed plugins are NOT marked auto-core', async () => {
    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      plugins: [listsPlugin],
      mode: 'testing'
    })

    const lists = app.options.plugins.find(p => p.name === 'lists')
    const router = app.options.plugins.find(p => p.name === 'router')

    assert.ok(lists, 'lists plugin should be registered')
    assert.ok(router, 'router plugin should be registered')
    assert.strictEqual(Object.hasOwn(lists, '_isAutoCorePlugin'), false, '_isAutoCorePlugin property should be absent on explicitly-passed plugin')
    assert.strictEqual(lists._isAutoCorePlugin, undefined)
    assert.strictEqual(router._isAutoCorePlugin, true)
  })

  it('app._explicitPluginNames reflects passed plugin names', async () => {
    const customPlugin = definePlugin({
      name: 'custom',
      client: {
        context: () => () => ({})
      }
    })

    const app = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      plugins: [customPlugin()],
      mode: 'testing'
    })

    assert.ok(app._explicitPluginNames instanceof Set)
    assert.strictEqual(app._explicitPluginNames.has('custom'), true)
    assert.strictEqual(app._explicitPluginNames.has('lists'), false)
    assert.strictEqual(app._explicitPluginNames.has('router'), false)
  })

  it('empty plugins array yields empty explicit set', async () => {
    const appWithEmptyPlugins = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      plugins: [],
      mode: 'testing'
    })

    assert.ok(appWithEmptyPlugins._explicitPluginNames instanceof Set)
    assert.strictEqual(appWithEmptyPlugins._explicitPluginNames.size, 0)

    const appWithNoPluginsOption = await createCoralite({
      components: componentsDir,
      pages: pagesDir,
      output: outputDir,
      mode: 'testing'
    })

    assert.ok(appWithNoPluginsOption._explicitPluginNames instanceof Set)
    assert.strictEqual(appWithNoPluginsOption._explicitPluginNames.size, 0)
  })
})
