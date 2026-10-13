
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'
import { deduplicateEnumeratedPaths } from '#lib/server/page/route.js'
import { CoraliteBuildError } from '#lib/shared/errors.js'
import { duplicatePathsPlugin } from '../../../fixtures/plugins/duplicate-paths-plugin.js'
import { uniquePathsPlugin } from '../../../fixtures/plugins/unique-paths-plugin.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../fixtures')
const componentsDir = join(fixturesDir, 'components')

let testDir
let pagesDir
let outputDir

describe('Task P2.07 - Enumeration deduplication', () => {
  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'coralite-p207-test-'))
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

  describe('deduplicateEnumeratedPaths unit function', () => {
    it('definePage.paths returns unique param sets -> list unchanged', () => {
      const contributions = [
        {
          source: 'definePage.paths',
          paths: [{ id: 'a' }, { id: 'b' }]
        }
      ]
      const result = deduplicateEnumeratedPaths(contributions, '/pages/[id].html')
      assert.deepStrictEqual(result, [{ id: 'a' }, { id: 'b' }])
    })

    it('definePage.paths returns duplicate param sets -> CoraliteBuildError naming page and source', () => {
      const contributions = [
        {
          source: 'definePage.paths',
          paths: [{ id: 'a' }, { id: 'a' }]
        }
      ]
      assert.throws(
        () => deduplicateEnumeratedPaths(contributions, '/pages/[id].html'),
        (err) => {
          assert.ok(err instanceof CoraliteBuildError)
          assert.ok(err.message.includes('Duplicate path in /pages/[id].html: { id: \'a\' }'))
          assert.ok(err.message.includes('Source: definePage.paths'))
          return true
        }
      )
    })

    it('Plugin returns a param set that duplicates definePage.paths -> CoraliteBuildError naming page, sources, and params', () => {
      const contributions = [
        {
          source: 'definePage.paths',
          paths: [{ id: 'intro' }]
        },
        {
          source: 'plugin "blog-routes"',
          paths: [{ id: 'intro' }]
        }
      ]
      assert.throws(
        () => deduplicateEnumeratedPaths(contributions, '/pages/[id].html'),
        (err) => {
          assert.ok(err instanceof CoraliteBuildError)
          assert.ok(err.message.includes('Conflicting path in /pages/[id].html: { id: \'intro\' }'))
          assert.ok(err.message.includes('Sources: definePage.paths and plugin "blog-routes"'))
          return true
        }
      )
    })

    it('Two plugins return the same param set -> CoraliteBuildError naming both plugin names and params', () => {
      const contributions = [
        {
          source: 'plugin "p1"',
          paths: [{ id: 'colliding' }]
        },
        {
          source: 'plugin "p2"',
          paths: [{ id: 'colliding' }]
        }
      ]
      assert.throws(
        () => deduplicateEnumeratedPaths(contributions, '/pages/[id].html'),
        (err) => {
          assert.ok(err instanceof CoraliteBuildError)
          assert.ok(err.message.includes('Conflicting path in /pages/[id].html: { id: \'colliding\' }'))
          assert.ok(err.message.includes('Sources: plugin "p1" and plugin "p2"'))
          return true
        }
      )
    })

    it('Plugin returns a unique param set -> merged, no error', () => {
      const contributions = [
        {
          source: 'definePage.paths',
          paths: [{ id: 'a' }]
        },
        {
          source: 'plugin "extra"',
          paths: [{ id: 'b' }]
        }
      ]
      const result = deduplicateEnumeratedPaths(contributions, '/pages/[id].html')
      assert.deepStrictEqual(result, [{ id: 'a' }, { id: 'b' }])
    })

    it('Param key order does not affect collision detection', () => {
      const contributions = [
        {
          source: 'definePage.paths',
          paths: [{
            a: '1',
            b: '2'
          }]
        },
        {
          source: 'plugin "p1"',
          paths: [{
            b: '2',
            a: '1'
          }]
        }
      ]
      assert.throws(
        () => deduplicateEnumeratedPaths(contributions, '/pages/[id].html'),
        (err) => {
          assert.ok(err instanceof CoraliteBuildError)
          assert.ok(err.message.includes('Conflicting path in /pages/[id].html'))
          assert.ok(err.message.includes('Sources: definePage.paths and plugin "p1"'))
          return true
        }
      )
    })

    it('Different param values do not collide', () => {
      const contributions = [
        {
          source: 'definePage.paths',
          paths: [{ id: 'a' }]
        },
        {
          source: 'plugin "p1"',
          paths: [{ id: 'b' }]
        }
      ]
      const result = deduplicateEnumeratedPaths(contributions, '/pages/[id].html')
      assert.deepStrictEqual(result, [{ id: 'a' }, { id: 'b' }])
    })

    it('Order is preserved: first occurrence determines position', () => {
      const contributions = [
        {
          source: 'definePage.paths',
          paths: [{ id: 'a' }, { id: 'b' }]
        },
        {
          source: 'plugin "p1"',
          paths: [{ id: 'c' }]
        },
        {
          source: 'plugin "p2"',
          paths: [{ id: 'd' }]
        }
      ]
      const result = deduplicateEnumeratedPaths(contributions, '/pages/[id].html')
      assert.deepStrictEqual(result, [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
        { id: 'd' }
      ])
    })
  })

  describe('Integration with Coralite build and collection', () => {
    it('same-source-duplicate fixture fails build with expected CoraliteBuildError', async () => {
      const sameSourceFixture = await readFile(
        join(fixturesDir, 'pages/dedup/same-source-duplicate.html'),
        'utf8'
      )
      await writeFile(join(pagesDir, '[id].html'), sameSourceFixture)

      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        output: outputDir,
        mode: 'testing'
      })

      await assert.rejects(
        async () => {
          await app.build()
        },
        (err) => {
          assert.ok(err instanceof CoraliteBuildError)
          assert.ok(err.message.includes('Duplicate path in'))
          assert.ok(err.message.includes('Source: definePage.paths'))
          return true
        }
      )
    })

    it('cross-source-duplicate fixture fails build with expected CoraliteBuildError', async () => {
      const crossSourceFixture = await readFile(
        join(fixturesDir, 'pages/dedup/cross-source-duplicate.html'),
        'utf8'
      )
      await writeFile(join(pagesDir, '[id].html'), crossSourceFixture)

      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        output: outputDir,
        plugins: [duplicatePathsPlugin],
        mode: 'testing'
      })

      await assert.rejects(
        async () => {
          await app.build()
        },
        (err) => {
          assert.ok(err instanceof CoraliteBuildError)
          assert.ok(err.message.includes('Conflicting path in'))
          assert.ok(err.message.includes('Sources: definePage.paths and plugin "duplicate-paths-plugin"'))
          return true
        }
      )
    })

    it('unique-paths-plugin fixture builds successfully', async () => {
      await writeFile(
        join(pagesDir, '[id].html'),
        `<script type="module">
          import { definePage } from 'coralite'
          export default definePage({
            paths () {
              return [{ id: 'own-path' }]
            }
          })
        </script>
        <h1>Page</h1>`
      )

      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        output: outputDir,
        plugins: [uniquePathsPlugin],
        mode: 'testing'
      })

      const results = await app.build('[id].html')
      assert.strictEqual(results.length, 2)
      const ownResult = results.find(r => r.route?.path === '/own-path')
      const pluginResult = results.find(r => r.route?.path === '/unique-from-plugin')
      assert.ok(ownResult, 'own-path result must exist')
      assert.ok(pluginResult, 'unique-from-plugin result must exist')
    })

    it('page that fails deduplication is marked failed; siblings continue and no partial output is produced for failed page', async () => {
      const failDir = join(pagesDir, 'fail')
      const siblingDir = join(pagesDir, 'sibling')
      await mkdir(failDir, { recursive: true })
      await mkdir(siblingDir, { recursive: true })

      // Failed page with same-source duplicates
      await writeFile(
        join(failDir, '[id].html'),
        `<script type="module">
          import { definePage } from 'coralite'
          export default definePage({
            paths () {
              return [{ id: 'dupe' }, { id: 'dupe' }]
            }
          })
        </script>
        <h1>Fail</h1>`
      )

      // Healthy sibling page
      await writeFile(
        join(siblingDir, '[id].html'),
        `<script type="module">
          import { definePage } from 'coralite'
          export default definePage({
            paths () {
              return [{ id: 'sibling-1' }, { id: 'sibling-2' }]
            }
          })
        </script>
        <h1>Sibling</h1>`
      )

      const app = await createCoralite({
        components: componentsDir,
        pages: pagesDir,
        output: outputDir,
        mode: 'testing'
      })

      const results = await app.build(null, {
        continueOnError: true,
        failOnError: false
      })

      // Sibling outputs rendered
      const sib1Result = results.find(r => r.route?.path === '/sibling/sibling-1')
      const sib2Result = results.find(r => r.route?.path === '/sibling/sibling-2')
      assert.ok(sib1Result, 'sibling-1 result must exist')
      assert.ok(sib2Result, 'sibling-2 result must exist')

      // Failing page produced NO output file ("No partial output")
      const dupeResult = results.find(r => r.route?.path === '/fail/dupe')
      assert.strictEqual(dupeResult, undefined, 'Failing page must not produce output file')

      // Failing page is recorded with status 'failed'
      const failedResult = results.find(r => r.status === 'failed')
      assert.ok(failedResult)
      assert.ok(failedResult.error.message.includes('Duplicate path in'))
    })
  })
})
