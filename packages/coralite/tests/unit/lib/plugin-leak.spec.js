import { describe, it, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createCoralite, definePlugin } from '#lib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { writeFile, unlink, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureRoot = join(__dirname, '../../fixtures')
const componentsDir = join(fixtureRoot, 'components/plugin-leak')
const pagesDir = join(fixtureRoot, 'pages/plugin-leak')

describe('Plugin Exports Leakage', async () => {
  let app

  afterEach(async () => {
    if (app) {
      await app.clearCache(true)
    }
  })

  it('should not leak plugin exports into component state', async () => {
    const myPlugin = definePlugin({
      name: 'my-plugin',
      server: {
        context: () => {
          return {
            myFunc: () => 'secret'
          }
        }
      }
    })

    const testDir = await mkdtemp(join(tmpdir(), 'coralite-leak-'))
    try {
      app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [myPlugin],
        projectRoot: testDir
      })

      const results = await app.build()
      const indexResult = results.find(r => r.path && r.path.filename === 'index.html')

      assert.ok(indexResult, 'index.html should be in results')

      const content = indexResult.content || ''

      // Check if leaked is false (we want it to be false)
      assert.ok(content.includes('false'), 'Plugin exports SHOULD NOT be leaked into state')
      assert.ok(content.includes('secret'), 'Imported secret should be present')
    } finally {
      await rm(testDir, {
        recursive: true,
        force: true
      }).catch(() => {
      })
    }
  })

  it('should fail to import plugin via virtual module', async () => {
    const myPlugin = definePlugin({
      name: 'my-plugin',
      server: {
        context: () => {
          return {
            myFunc: () => 'secret'
          }
        }
      }
    })

    const testDir = await mkdtemp(join(tmpdir(), 'coralite-leak-failing-'))
    const failingCompPath = join(componentsDir, 'failing-comp.html')
    const failingPagePath = join(pagesDir, 'failing-page.html')

    try {
      app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [myPlugin],
        projectRoot: testDir
      })

      const failingComponent = `
<template id="failing-comp"><div></div></template>
<script type="module">
  import { defineComponent } from 'coralite'
  import * as myPlugin from 'my-plugin'
  export default defineComponent({
    server() { return {} }
  })
</script>`

      const failingPage = '<failing-comp></failing-comp>'

      await writeFile(failingCompPath, failingComponent)
      await app.components.setItem(failingCompPath)

      await writeFile(failingPagePath, failingPage)
      await app.pages.setItem(failingPagePath)

      await app.build()
      assert.fail('Should have failed to build due to missing virtual module')
    } catch (error) {
      const msg = error.message
      const isResolutionError = msg.includes('Cannot find module') ||
                               msg.includes('failed to resolve') ||
                               msg.includes('Module not found') ||
                               msg.includes('is not defined') ||
                               msg.includes('Cannot find package') ||
                               msg.includes('ERR_MODULE_NOT_FOUND')

      assert.ok(isResolutionError, 'Error should be about module resolution, got: ' + msg)
    } finally {
      await unlink(failingCompPath).catch(() => {
      })
      if (app) {
        app.components.deleteItem(failingCompPath)
      }
      await unlink(failingPagePath).catch(() => {
      })
      if (app) {
        app.pages.deleteItem(failingPagePath)
      }
      await rm(testDir, {
        recursive: true,
        force: true
      }).catch(() => {
      })
    }
  })

  it('should throw an error if two plugins have conflicting export names', async () => {
    const plugin1 = definePlugin({
      name: 'plugin1',
      server: {
        name: 'conflict',
        context: () => {
          return { conflict: () => 'p1' }
        }
      }
    })

    const plugin2 = definePlugin({
      name: 'plugin2',
      server: {
        name: 'conflict',
        context: () => {
          return { conflict: () => 'p2' }
        }
      }
    })

    try {
      await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        plugins: [plugin1, plugin2]
      })
      assert.fail('Should have thrown an error due to conflicting export names')
    } catch (error) {
      assert.ok(error.message.includes('Plugin export name conflict'), 'Error message should mention conflict')
      assert.ok(error.message.includes('conflict'), 'Error message should mention the conflicting name')
      assert.ok(error.message.includes('plugin2'), 'Error message should mention the conflicting plugin')
    }
  })
})
