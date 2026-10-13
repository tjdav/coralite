import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '../../../../lib/server/create.js'
import { definePlugin } from '../../../../lib/server/plugin/define.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../fixtures')
const componentsDir = join(fixturesDir, 'components')

async function createTempPagesDir (files) {
  const tempDir = await mkdtemp(join(tmpdir(), 'coralite-p206-test-'))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(tempDir, relPath)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content, 'utf8')
  }
  return tempDir
}

describe('Task P2.06 - onPageSet return { paths } plugin route enumeration', () => {
  it('single plugin returns valid { paths } -> paths merged after definePage.paths', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'plugin-a',
        server: {
          onPageSet () {
            return { paths: [{ slug: 'plugin-slug-1' }, { slug: 'plugin-slug-2' }] }
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      const pageItem = app.pages.getItem('[slug].html')
      assert.ok(pageItem, 'pageItem should exist')
      assert.deepStrictEqual(pageItem.result.page.enumeratedPaths, [
        { slug: 'plugin-slug-1' },
        { slug: 'plugin-slug-2' }
      ])
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('two plugins return valid { paths } -> merged in plugin registration order', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin1 = definePlugin({
        name: 'plugin-1',
        server: {
          onPageSet () {
            return { paths: [{ slug: 'p1-a' }] }
          }
        }
      })

      const plugin2 = definePlugin({
        name: 'plugin-2',
        server: {
          onPageSet () {
            return { paths: [{ slug: 'p2-b' }] }
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin1, plugin2],
        mode: 'testing'
      })

      const pageItem = app.pages.getItem('[slug].html')
      assert.deepStrictEqual(pageItem.result.page.enumeratedPaths, [
        { slug: 'p1-a' },
        { slug: 'p2-b' }
      ])
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns undefined -> no contribution, no error', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'noop-plugin-undefined',
        server: {
          onPageSet () {
            return undefined
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      const pageItem = app.pages.getItem('[slug].html')
      assert.deepStrictEqual(pageItem.result.page.enumeratedPaths, [])
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns null -> no contribution, no error', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'noop-plugin-null',
        server: {
          onPageSet () {
            return null
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      const pageItem = app.pages.getItem('[slug].html')
      assert.deepStrictEqual(pageItem.result.page.enumeratedPaths, [])
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns {} -> no contribution, no error', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'noop-plugin-empty-obj',
        server: {
          onPageSet () {
            return {}
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      const pageItem = app.pages.getItem('[slug].html')
      assert.deepStrictEqual(pageItem.result.page.enumeratedPaths, [])
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns { paths: "not-an-array" } -> CORALITE-E407', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'invalid-plugin-string-paths',
        server: {
          onPageSet () {
            return { paths: 'not-an-array' }
          }
        }
      })

      await assert.rejects(
        async () => {
          await createCoralite({
            components: componentsDir,
            pages: tempPagesDir,
            plugins: [plugin],
            mode: 'testing'
          })
        },
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-E407')
          return true
        }
      )
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns { paths: ["string-entry"] } -> CORALITE-E407', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'invalid-plugin-string-entry',
        server: {
          onPageSet () {
            return { paths: ['string-entry'] }
          }
        }
      })

      await assert.rejects(
        async () => {
          await createCoralite({
            components: componentsDir,
            pages: tempPagesDir,
            plugins: [plugin],
            mode: 'testing'
          })
        },
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-E407')
          return true
        }
      )
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns { paths: [{ wrongParam: "x" }] } -> CORALITE-E407', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'invalid-plugin-wrong-param',
        server: {
          onPageSet () {
            return { paths: [{ wrongParam: 'x' }] }
          }
        }
      })

      await assert.rejects(
        async () => {
          await createCoralite({
            components: componentsDir,
            pages: tempPagesDir,
            plugins: [plugin],
            mode: 'testing'
          })
        },
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-E407')
          return true
        }
      )
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns { paths: [{ slug: 42 }] } -> CORALITE-E407', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'invalid-plugin-number-param',
        server: {
          onPageSet () {
            return { paths: [{ slug: 42 }] }
          }
        }
      })

      await assert.rejects(
        async () => {
          await createCoralite({
            components: componentsDir,
            pages: tempPagesDir,
            plugins: [plugin],
            mode: 'testing'
          })
        },
        (err) => {
          assert.strictEqual(err.code, 'CORALITE-E407')
          return true
        }
      )
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('page with no definePage.paths but a plugin enumerates -> page becomes dynamic and renders N files', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post: {{ route.params.slug }}</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'dyn-plugin',
        server: {
          onPageSet () {
            return { paths: [{ slug: 'dyn-1' }, { slug: 'dyn-2' }] }
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      const buildResults = await app.build('[slug].html')
      assert.strictEqual(buildResults.length, 2)
      assert.ok(buildResults.some(r => r.route?.path === '/dyn-1'))
      assert.ok(buildResults.some(r => r.route?.path === '/dyn-2'))
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('page with definePage.paths and a plugin enumerating -> merged result renders', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': `
        <h1>Post: {{ route.params.slug }}</h1>
        <script>
          import { definePage } from 'coralite'
          export default definePage({
            paths () {
              return [
                { slug: 'own-1' },
                { slug: 'own-2' }
              ]
            }
          })
        </script>
      `
    })

    try {
      const plugin = definePlugin({
        name: 'additive-plugin',
        server: {
          onPageSet () {
            return { paths: [{ slug: 'plugin-added' }] }
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      const pageItem = app.pages.getItem('[slug].html')
      assert.deepStrictEqual(pageItem.result.page.enumeratedPaths, [
        { slug: 'own-1' },
        { slug: 'own-2' },
        { slug: 'plugin-added' }
      ])

      const buildResults = await app.build('[slug].html')
      assert.strictEqual(buildResults.length, 3)
      assert.ok(buildResults.some(r => r.route?.path === '/own-1'))
      assert.ok(buildResults.some(r => r.route?.path === '/own-2'))
      assert.ok(buildResults.some(r => r.route?.path === '/plugin-added'))
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('static page with no plugin enumeration -> unchanged', async () => {
    const tempPagesDir = await createTempPagesDir({
      'index.html': '<h1>Home</h1>'
    })

    try {
      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        mode: 'testing'
      })

      const pageItem = app.pages.getItem('index.html')
      assert.ok(pageItem)
      assert.deepStrictEqual(pageItem.result.page.enumeratedPaths, [])
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns duplicate paths -> throws CoraliteBuildError naming plugin source', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': '<h1>Post</h1>'
    })

    try {
      const plugin = definePlugin({
        name: 'duplicate-plugin',
        server: {
          onPageSet () {
            return { paths: [{ slug: 'dupe' }, { slug: 'dupe' }] }
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      await assert.rejects(
        async () => {
          await app.build('[slug].html')
        },
        (err) => {
          assert.ok(err.message.includes('Duplicate path in'))
          assert.ok(err.message.includes('Source: plugin "duplicate-plugin"'))
          return true
        }
      )
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })

  it('plugin returns path colliding with definePage.paths -> throws CoraliteBuildError naming both sources', async () => {
    const tempPagesDir = await createTempPagesDir({
      '[slug].html': `
        <h1>Post</h1>
        <script>
          import { definePage } from 'coralite'
          export default definePage({
            paths () {
              return [{ slug: 'conflict-slug' }]
            }
          })
        </script>
      `
    })

    try {
      const plugin = definePlugin({
        name: 'colliding-plugin',
        server: {
          onPageSet () {
            return { paths: [{ slug: 'conflict-slug' }] }
          }
        }
      })

      const app = await createCoralite({
        components: componentsDir,
        pages: tempPagesDir,
        plugins: [plugin],
        mode: 'testing'
      })

      await assert.rejects(
        async () => {
          await app.build('[slug].html')
        },
        (err) => {
          assert.ok(err.message.includes('Conflicting path in'))
          assert.ok(err.message.includes('Sources: definePage.paths and plugin "colliding-plugin"'))
          return true
        }
      )
    } finally {
      await rm(tempPagesDir, {
        recursive: true,
        force: true
      })
    }
  })
})
