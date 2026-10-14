import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadComponent, loadPage } from '../../../lib/testing.js'
import { CoraliteError } from '../../../lib/shared/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../../fixtures/testing')

describe('coralite/testing helpers', () => {
  describe('loadComponent', () => {
    it('should load a component with a server() block and return the server result', async () => {
      const compPath = resolve(fixturesDir, 'load-component-basic.html')
      const comp = await loadComponent(compPath)

      assert.strictEqual(comp.componentId, 'x-load-component-basic')
      assert.strictEqual(comp.errors.length, 0)
      assert.ok(comp.source.includes('<template id="x-load-component-basic">'))

      const state = await comp.server()
      assert.strictEqual(state.message, 'Loaded basic component')
    })

    it('should load a component with a client() block and expose callable client', async () => {
      const compPath = resolve(fixturesDir, 'load-component-client.html')
      const comp = await loadComponent(compPath)

      assert.strictEqual(comp.errors.length, 0)

      const state = await comp.server()
      assert.strictEqual(state.count, 10)

      await comp.client({ state })
      assert.strictEqual(state.count, 11)
    })

    it('should populate errors and not throw for a component without a <script> block', async () => {
      const compPath = resolve(fixturesDir, 'load-component-malformed.html')
      const comp = await loadComponent(compPath)

      assert.ok(comp.errors.length > 0)
      assert.strictEqual(typeof comp.server, 'function')
      assert.strictEqual(typeof comp.client, 'function')

      const serverRes = await comp.server()
      assert.deepStrictEqual(serverRes, {})
    })

    it('should throw CoraliteError naming the path when file does not exist', async () => {
      await assert.rejects(
        async () => {
          await loadComponent('nonexistent-component-file.html')
        },
        (err) => {
          assert.ok(err instanceof CoraliteError)
          assert.ok(err.filePath.includes('nonexistent-component-file.html'))
          return true
        }
      )
    })

    it('should support transform option and merge context option', async () => {
      const compPath = resolve(fixturesDir, 'load-component-basic.html')
      let transformed = false

      const comp = await loadComponent(compPath, {
        transform (src) {
          transformed = true
          return src
        },
        context: {
          customContextVal: 'hello-from-context'
        }
      })

      assert.ok(transformed)
      const serverRes = await comp.server()
      assert.strictEqual(serverRes.message, 'Loaded basic component')
    })
  })

  describe('loadPage', () => {
    it('should load a page with a server() block and return server result', async () => {
      const pagePath = resolve(fixturesDir, 'load-page-basic.html')
      const page = await loadPage(pagePath)

      assert.strictEqual(page.errors.length, 0)
      assert.ok(page.source.includes('<h1>{{ title }}</h1>'))

      const state = await page.server()
      assert.strictEqual(state.title, 'Basic Page Title')
    })

    it('should load a page with both paths() and server() blocks', async () => {
      const pagePath = resolve(fixturesDir, 'load-page-paths.html')
      const page = await loadPage(pagePath)

      assert.strictEqual(page.errors.length, 0)

      const paths = await page.paths()
      assert.deepEqual(JSON.parse(JSON.stringify(paths)), [{ id: '1' }, { id: '2' }])

      const state = await page.server({
        route: {
          path: '/posts/1',
          pattern: '/posts/:id',
          params: { id: '1' },
          dynamic: true
        }
      })
      assert.strictEqual(state.id, '1')
    })

    it('should re-throw error with page path attached when paths() throws', async () => {
      const pagePath = resolve(__dirname, '../../fixtures/pages/with-paths-throwing.html')
      const page = await loadPage(pagePath)

      await assert.rejects(
        async () => {
          await page.paths()
        },
        (err) => {
          assert.ok(err.filePath.includes('with-paths-throwing.html'))
          return true
        }
      )
    })

    it('should verify errors thrown inside server() use VM evaluator error shape with filePath attached', async () => {
      const pagePath = resolve(__dirname, '../../fixtures/pages/with-paths-invalid.html')
      const page = await loadPage(pagePath)

      const pathsRes = await page.paths()
      assert.strictEqual(pathsRes, 'invalid')
    })
  })
})
