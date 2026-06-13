import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createCoralite } from '../../../../lib/coralite.js'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '../../../../')
const components = join(projectRoot, 'tests/fixtures/components/static-components')
const pages = join(projectRoot, 'tests/fixtures/pages/static-components')

describe('onBeforeBuild Build Queue', () => {
  let app

  afterEach(async () => {
    if (app) {
      await app.clearCache(true)
    }
  })

  test('dynamic pages added via app.pages.setItem in onBeforeBuild are included in full build', async () => {
    const plugin = {
      name: 'test-plugin',
      server: {
        async onBeforeBuild ({ app }) {
          await app.pages.setItem({
            virtual: true,
            path: {
              pathname: '/virtual-page',
              dirname: '/',
              filename: 'virtual-page'
            },
            content: '<html><body>Virtual Page</body></html>'
          })
        }
      }
    }

    app = await createCoralite({
      components,
      pages,
      plugins: [plugin],
      projectRoot
    })

    const results = await app.build()
    const virtualPage = results.find(r => r.path.pathname === '/virtual-page')
    assert.ok(virtualPage, 'Virtual page should be in the build results')
    assert.strictEqual(virtualPage.content.includes('Virtual Page'), true)
  })

  test('targeted build does not include unrelated pages added in onBeforeBuild', async () => {
    const plugin = {
      name: 'test-plugin',
      server: {
        async onBeforeBuild ({ app }) {
          await app.pages.setItem({
            path: {
              pathname: '/unrelated-virtual-page',
              dirname: '/',
              filename: 'unrelated-virtual-page'
            },
            content: '<html><body>Unrelated</body></html>'
          })
        }
      }
    }

    app = await createCoralite({
      components,
      pages,
      plugins: [plugin],
      projectRoot
    })

    // Targeted build for a specific page
    const results = await app.build('/index.html')
    const unrelatedPage = results.find(r => r.path.pathname === '/unrelated-virtual-page')
    assert.strictEqual(unrelatedPage, undefined, 'Unrelated virtual page should NOT be in targeted build results')
  })

  test('pre-bound addRenderQueue in onBeforeBuild works without buildId', async () => {
    const plugin = {
      name: 'test-plugin',
      server: {
        async onBeforeBuild ({ addRenderQueue }) {
          await addRenderQueue({
            pathname: '/explicit-virtual-page',
            content: '<html><body>Explicit</body></html>'
          })
        }
      }
    }

    app = await createCoralite({
      components,
      pages,
      plugins: [plugin],
      projectRoot
    })

    const results = await app.build('/index.html')
    const explicitPage = results.find(r => r.path.pathname === '/explicit-virtual-page')
    assert.ok(explicitPage, 'Explicitly added virtual page should be in the build results even in targeted build if added via addRenderQueue')
    assert.strictEqual(explicitPage.content.includes('Explicit'), true)
  })

  test('deduplication of pages in build queue', async () => {
    const plugin = {
      name: 'test-plugin',
      server: {
        async onBeforeBuild ({ app, addRenderQueue }) {
          // Add via setItem (will be picked up by resolvePageQueue later)
          await app.pages.setItem({
            virtual: true,
            path: {
              pathname: '/duplicate-page',
              dirname: '/',
              filename: 'duplicate-page'
            },
            content: '<html><body>Duplicate</body></html>'
          })
          // Also add explicitly via addRenderQueue
          await addRenderQueue('/duplicate-page')
        }
      }
    }

    app = await createCoralite({
      components,
      pages,
      plugins: [plugin],
      projectRoot
    })

    const results = await app.build()
    const duplicatePages = results.filter(r => r.path.pathname === '/duplicate-page')
    assert.strictEqual(duplicatePages.length, 1, 'Duplicate page should only appear once in build results')
  })
})
