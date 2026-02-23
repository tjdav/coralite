import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import path from 'node:path'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Coralite from '#lib'

describe('Coralite', () => {
  let testDir
  let pagesDir
  let templatesDir
  let coralite

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'coralite-test-'))
    pagesDir = path.join(testDir, 'pages')
    templatesDir = path.join(testDir, 'templates')

    await mkdir(pagesDir)
    await mkdir(templatesDir)

    // Create a basic page
    await writeFile(path.join(pagesDir, 'index.html'), '<h1>Hello World</h1>')

    // Create a basic template
    await writeFile(path.join(templatesDir, 'layout.html'), '<slot></slot>')
  })

  afterEach(async () => {
    await rm(testDir, {
      recursive: true,
      force: true
    })
  })

  describe('onBuildComplete hook', () => {
    it('should be called after a successful build', async () => {
      let hookCalled = false
      let hookContext = null

      const plugin = {
        name: 'test-plugin',
        onBuildComplete: async (context) => {
          hookCalled = true
          hookContext = context
        }
      }

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        plugins: [plugin]
      })

      await coralite.initialise()
      await coralite.build()

      assert.ok(hookCalled, 'onBuildComplete hook should be called')
      assert.ok(hookContext, 'context should be passed to the hook')
      assert.ok(Array.isArray(hookContext.results), 'results should be an array')
      assert.strictEqual(hookContext.results.length, 1, 'should have 1 result')
      assert.strictEqual(hookContext.error, null, 'error should be null on success')
      assert.ok(typeof hookContext.duration === 'number', 'duration should be a number')
    })

    it('should be called after a failed build with error', async () => {
      let hookCalled = false
      let hookContext = null

      const plugin = {
        name: 'test-plugin',
        onBuildComplete: async (context) => {
          hookCalled = true
          hookContext = context
        }
      }

      const errorPlugin = {
        name: 'error-plugin',
        onAfterPageRender: async () => {
          throw new Error('Test Error')
        }
      }

      coralite = new Coralite({
        pages: pagesDir,
        templates: templatesDir,
        plugins: [plugin, errorPlugin]
      })

      await coralite.initialise()

      try {
        await coralite.build()
      } catch (e) {
        // Expected error
      }

      assert.ok(hookCalled, 'onBuildComplete hook should be called even on error')
      assert.ok(hookContext.error, 'error should be present')
      assert.ok(hookContext.error.message.includes('Test Error'), 'error message should match')
      assert.ok(typeof hookContext.duration === 'number', 'duration should be a number')
    })
  })
})
