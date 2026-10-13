import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rm } from 'node:fs/promises'
import { validateRouteTable } from '../../../../../lib/server/routes/validate.js'
import createCoralite from '../../../../../lib/index.js'
import { CoraliteBuildError } from '../../../../../lib/shared/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../../fixtures/routes')

describe('validateRouteTable', () => {
  it('unambiguous route table passes validation without error', () => {
    const routeTable = {
      patterns: [
        {
          pattern: '/about',
          params: [],
          segments: [{
            type: 'static',
            value: 'about'
          }],
          pagePath: '/pages/about.html',
          type: 'static'
        }
      ]
    }
    const pages = [
      {
        filePath: '/pages/about.html',
        routePattern: '/about'
      }
    ]

    assert.doesNotThrow(() => {
      validateRouteTable(routeTable, pages)
    })
  })

  it('URL matching a different winning pattern throws CoraliteBuildError', () => {
    const routeTable = {
      patterns: [
        {
          pattern: '/docs/api',
          params: [],
          segments: [
            {
              type: 'static',
              value: 'docs'
            },
            {
              type: 'static',
              value: 'api'
            }
          ],
          pagePath: '/pages/docs/api.html',
          type: 'static'
        },
        {
          pattern: '/docs/:slug',
          params: ['slug'],
          segments: [
            {
              type: 'static',
              value: 'docs'
            },
            {
              type: 'param',
              value: 'slug'
            }
          ],
          pagePath: '/pages/docs/[slug].html',
          type: 'dynamic'
        }
      ]
    }
    // Page [slug].html enumerates slug: 'api', producing URL /docs/api, which loses to static page /docs/api
    const pages = [
      {
        filePath: '/pages/docs/api.html',
        routePattern: '/docs/api',
        enumeratedPaths: []
      },
      {
        filePath: '/pages/docs/[slug].html',
        routePattern: '/docs/:slug',
        enumeratedPaths: [{ slug: 'api' }]
      }
    ]

    assert.throws(() => validateRouteTable(routeTable, pages), (err) => {
      assert.ok(err instanceof CoraliteBuildError)
      assert.ok(err.message.includes('/pages/docs/[slug].html'))
      assert.ok(err.message.includes('/docs/:slug'))
      assert.ok(err.message.includes('/docs/api'))
      return true
    })
  })
})

describe('Route validation integration in Coralite build', () => {
  const precedenceDir = join(fixturesDir, 'precedence')
  const ambiguousDir = join(fixturesDir, 'ambiguous')

  afterEach(async () => {
    await rm(join(precedenceDir, '.coralite'), {
      recursive: true,
      force: true
    })
    await rm(join(precedenceDir, 'dist'), {
      recursive: true,
      force: true
    })
    await rm(join(ambiguousDir, '.coralite'), {
      recursive: true,
      force: true
    })
    await rm(join(ambiguousDir, 'dist'), {
      recursive: true,
      force: true
    })
  })

  it('precedence fixture builds successfully', async () => {
    const app = await createCoralite({
      projectRoot: precedenceDir,
      pages: join(precedenceDir, 'pages'),
      components: join(precedenceDir, 'components'),
      output: join(precedenceDir, 'dist'),
      mode: 'production'
    })

    await app.build()
  })

  it('ambiguous fixture fails build with CoraliteBuildError', async () => {
    const app = await createCoralite({
      projectRoot: ambiguousDir,
      pages: join(ambiguousDir, 'pages'),
      components: join(ambiguousDir, 'components'),
      output: join(ambiguousDir, 'dist'),
      mode: 'production'
    })

    await assert.rejects(async () => {
      await app.build()
    }, CoraliteBuildError)
  })
})
