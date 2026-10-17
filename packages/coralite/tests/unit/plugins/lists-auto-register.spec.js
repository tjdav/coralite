import { test, describe } from 'node:test'
import assert from 'node:assert'
import { createCoralite } from '../../../lib/server/create.js'
import { listsPlugin } from '../../../plugins/lists.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir, rm, writeFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const tmpDir = join(__dirname, '../../tmp-auto-register-spec')

async function setupTmpProject () {
  await rm(tmpDir, {
    recursive: true,
    force: true
  })
  await mkdir(join(tmpDir, 'pages'), { recursive: true })
  await mkdir(join(tmpDir, 'components'), { recursive: true })
  await mkdir(join(tmpDir, 'dist'), { recursive: true })

  await writeFile(
    join(tmpDir, 'pages/index.html'),
    `<!DOCTYPE html>
<html>
  <head><title>Test</title></head>
  <body><h1>Index</h1></body>
</html>`
  )
}

async function teardownTmpProject () {
  await rm(tmpDir, {
    recursive: true,
    force: true
  })
}

describe('Core Plugins Auto-Registration & Lists Architecture', () => {
  test('createCoralite auto-registers lists and router plugins when user specifies no plugins', async () => {
    await setupTmpProject()
    try {
      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        output: join(tmpDir, 'dist'),
        mode: 'testing'
      })

      const pluginNames = app.options.plugins.map(p => p.name)
      assert.ok(pluginNames.includes('lists'), 'lists plugin should be auto-registered')
      assert.ok(pluginNames.includes('router'), 'router plugin should be auto-registered')
    } finally {
      await teardownTmpProject()
    }
  })

  test('user plugins override or deduplicate core plugins by name', async () => {
    await setupTmpProject()
    try {
      const customListsMarker = { name: 'custom-lists-marker' }
      const userListsPlugin = {
        name: 'lists',
        customMarker: customListsMarker
      }

      const app = await createCoralite({
        components: join(tmpDir, 'components'),
        pages: join(tmpDir, 'pages'),
        output: join(tmpDir, 'dist'),
        mode: 'testing',
        plugins: [userListsPlugin]
      })

      const listsPlugins = app.options.plugins.filter(p => p.name === 'lists')
      assert.strictEqual(listsPlugins.length, 1, 'there should be exactly one lists plugin after deduplication')
      assert.strictEqual(listsPlugins[0].customMarker, customListsMarker, 'user-provided lists plugin should override default lists plugin')
    } finally {
      await teardownTmpProject()
    }
  })

  test('listsPlugin client context returns createStore and bind via two-phase resolver', async () => {
    assert.strictEqual(typeof listsPlugin.client.context, 'function', 'client.context should be a function')
    const phase2Factory = await listsPlugin.client.context()
    assert.strictEqual(typeof phase2Factory, 'function', 'phase 1 should return a phase 2 factory function')

    const listsApi = phase2Factory()
    assert.ok(listsApi, 'phase2 factory should return listsApi object')
    assert.strictEqual(typeof listsApi.createStore, 'function', 'listsApi.createStore should be a function')
    assert.strictEqual(typeof listsApi.bind, 'function', 'listsApi.bind should be a function')
  })
})
