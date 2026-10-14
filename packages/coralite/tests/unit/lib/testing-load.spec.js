/* eslint-disable no-restricted-imports -- Node test runner spec; requires node:* builtins */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadComponent, loadPage } from '#lib/testing.js'
import { CoraliteError } from '#lib/utils/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../fixtures/testing')

describe('coralite/testing exports', () => {
  describe('loadComponent', () => {
    test('returns server result for component with server() block', async () => {
      const path = join(fixturesDir, 'load-component-basic.html')
      const comp = await loadComponent(path)

      assert.equal(comp.componentId, 'load-component-basic')
      assert.equal(typeof comp.server, 'function')
      assert.equal(typeof comp.client, 'function')
      assert.deepEqual(comp.errors, [])

      const state = await comp.server({
        route: { path: '/', params: { inc: 5 } },
        initialCount: 10
      })

      assert.deepEqual(state, { count: 15 })
    })

    test('exposes callable client function for component with client() block', async () => {
      const path = join(fixturesDir, 'load-component-client.html')
      const comp = await loadComponent(path)

      const state = await comp.server()
      assert.deepEqual(state, { count: 10 })

      const clientState = { ...state }
      const controller = new AbortController()

      await comp.client({
        state: clientState,
        refs: (name) => (name === 'btn' ? {} : null),
        signal: controller.signal
      })

      assert.equal(clientState.clientInitialized, true)
      assert.equal(clientState.refFound, true)
      assert.equal(clientState.hasSignal, true)
    })

    test('populates errors and does not throw for component without script block', async () => {
      const path = join(fixturesDir, 'load-component-malformed.html')
      const comp = await loadComponent(path)

      assert.equal(comp.componentId, 'load-component-malformed')
      assert.ok(comp.errors.length > 0)
      assert.match(comp.errors[0], /script/i)

      const serverRes = await comp.server()
      assert.deepEqual(serverRes, {})
    })

    test('throws CoraliteError naming the path on nonexistent file', async () => {
      const nonexistentPath = join(fixturesDir, 'does-not-exist.html')

      await assert.rejects(
        async () => {
          await loadComponent(nonexistentPath)
        },
        (err) => {
          assert.ok(err instanceof CoraliteError)
          assert.ok(err.message.includes(nonexistentPath) || err.filePath === nonexistentPath)
          return true
        }
      )
    })

    test('merges context option into evaluation context', async () => {
      const path = join(fixturesDir, 'load-component-basic.html')
      const comp = await loadComponent(path, {
        context: {
          initialCount: 42
        }
      })

      const state = await comp.server({
        route: { params: { inc: 3 } }
      })

      assert.deepEqual(state, { count: 45 })
    })

    test('applies transform option to source code before evaluation', async () => {
      const path = join(fixturesDir, 'load-component-basic.html')
      const comp = await loadComponent(path, {
        transform: (src) => src.replace('route?.params?.inc || 0', '100')
      })

      const state = await comp.server({ initialCount: 5 })
      assert.deepEqual(state, { count: 105 })
    })

    test('uses framework VM evaluator and attaches component path on server error', async () => {
      const path = join(fixturesDir, 'load-component-basic.html')
      const comp = await loadComponent(path, {
        transform: (src) => src.replace('return {', 'throw new Error("VM Error inside server block"); return {')
      })

      await assert.rejects(
        async () => {
          await comp.server()
        },
        (err) => {
          assert.equal(err.message, 'VM Error inside server block')
          assert.equal(err.filePath, resolve(process.cwd(), path))
          return true
        }
      )
    })
  })

  describe('loadPage', () => {
    test('returns server result for page with server() block', async () => {
      const path = join(fixturesDir, 'load-page-basic.html')
      const page = await loadPage(path)

      assert.equal(typeof page.server, 'function')
      assert.equal(typeof page.paths, 'function')
      assert.deepEqual(page.errors, [])

      const state = await page.server({
        route: { path: '/about' }
      })

      assert.deepEqual(state, { pageTitle: 'Title for /about' })
    })

    test('returns paths and server callables for page with paths() and server()', async () => {
      const path = join(fixturesDir, 'load-page-paths.html')
      const page = await loadPage(path)

      const paths = await page.paths()
      assert.deepEqual(paths, [{ id: '1' }, { id: '2' }])

      const state = await page.server({
        route: { path: '/posts/1', params: { id: '1' } }
      })

      assert.deepEqual(state, { title: 'Post 1' })
    })

    test('re-throws error with page path when paths() block throws', async () => {
      const path = join(fixturesDir, 'load-page-paths.html')
      const page = await loadPage(path)

      await assert.rejects(
        async () => {
          await page.paths({ app: { shouldThrowInPaths: true } })
        },
        (err) => {
          assert.equal(err.message, 'Paths evaluation failed intentionally')
          assert.equal(err.filePath, resolve(process.cwd(), path))
          return true
        }
      )
    })

    test('parses routePattern and routeParams correctly from page path', async () => {
      const path = join(fixturesDir, 'pages/posts/[id].html')
      const page = await loadPage(path)

      assert.equal(page.routePattern, '/posts/:id')
      assert.deepEqual(page.routeParams, ['id'])
    })

    test('throws CoraliteError naming the path on nonexistent page file', async () => {
      const nonexistentPath = join(fixturesDir, 'nonexistent-page.html')

      await assert.rejects(
        async () => {
          await loadPage(nonexistentPath)
        },
        (err) => {
          assert.ok(err instanceof CoraliteError)
          assert.ok(err.message.includes(nonexistentPath) || err.filePath === nonexistentPath)
          return true
        }
      )
    })

    test('merges context option into page evaluation context', async () => {
      const path = join(fixturesDir, 'load-page-basic.html')
      const page = await loadPage(path, {
        context: {
          route: { path: '/override' }
        }
      })

      const state = await page.server()
      assert.deepEqual(state, { pageTitle: 'Title for /override' })
    })
  })
})
