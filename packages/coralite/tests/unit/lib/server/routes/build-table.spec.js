import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFile, rm } from 'node:fs/promises'
import { buildRouteTable } from '../../../../../lib/server/routes/build-table.js'
import createCoralite from '../../../../../lib/index.js'
import { CoraliteBuildError } from '../../../../../lib/shared/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '../../../../fixtures/routes')

describe('buildRouteTable', () => {
  it('single static page produces one pattern entry with type: "static"', () => {
    const pages = [
      {
        result: {
          page: {
            routePattern: '/about',
            routeParams: [],
            routeSegments: [
              {
                type: 'static',
                value: 'about'
              }
            ],
            file: {
              pathname: '/abs/path/pages/about.html'
            }
          }
        }
      }
    ]

    const result = buildRouteTable(pages)
    assert.deepEqual(result, {
      patterns: [
        {
          pattern: '/about',
          params: [],
          segments: [
            {
              type: 'static',
              value: 'about'
            }
          ],
          pagePath: '/abs/path/pages/about.html',
          type: 'static'
        }
      ]
    })
  })

  it('single dynamic page produces one pattern entry with type: "dynamic"', () => {
    const pages = [
      {
        result: {
          page: {
            routePattern: '/posts/:id',
            routeParams: ['id'],
            routeSegments: [
              {
                type: 'static',
                value: 'posts'
              },
              {
                type: 'param',
                value: 'id'
              }
            ],
            file: {
              pathname: '/abs/path/pages/posts/[id].html'
            }
          }
        }
      }
    ]

    const result = buildRouteTable(pages)
    assert.deepEqual(result, {
      patterns: [
        {
          pattern: '/posts/:id',
          params: ['id'],
          segments: [
            {
              type: 'static',
              value: 'posts'
            },
            {
              type: 'param',
              value: 'id'
            }
          ],
          pagePath: '/abs/path/pages/posts/[id].html',
          type: 'dynamic'
        }
      ]
    })
  })

  it('catch-all page produces a pattern entry with a catchall segment', () => {
    const pages = [
      {
        result: {
          page: {
            routePattern: '/docs/:slug*',
            routeParams: ['slug'],
            routeSegments: [
              {
                type: 'static',
                value: 'docs'
              },
              {
                type: 'catchall',
                value: 'slug'
              }
            ],
            file: {
              pathname: '/abs/path/pages/docs/[...slug].html'
            }
          }
        }
      }
    ]

    const result = buildRouteTable(pages)
    assert.deepEqual(result, {
      patterns: [
        {
          pattern: '/docs/:slug*',
          params: ['slug'],
          segments: [
            {
              type: 'static',
              value: 'docs'
            },
            {
              type: 'catchall',
              value: 'slug'
            }
          ],
          pagePath: '/abs/path/pages/docs/[...slug].html',
          type: 'dynamic'
        }
      ]
    })
  })

  it('multiple pages produce multiple entries, ordered deterministically by pagePath', () => {
    const pages = [
      {
        result: {
          page: {
            routePattern: '/posts/:id',
            routeParams: ['id'],
            routeSegments: [
              {
                type: 'static',
                value: 'posts'
              },
              {
                type: 'param',
                value: 'id'
              }
            ],
            file: {
              pathname: '/abs/path/pages/posts/[id].html'
            }
          }
        }
      },
      {
        result: {
          page: {
            routePattern: '/about',
            routeParams: [],
            routeSegments: [
              {
                type: 'static',
                value: 'about'
              }
            ],
            file: {
              pathname: '/abs/path/pages/about.html'
            }
          }
        }
      }
    ]

    const result = buildRouteTable(pages)
    assert.strictEqual(result.patterns.length, 2)
    assert.strictEqual(result.patterns[0].pagePath, '/abs/path/pages/about.html')
    assert.strictEqual(result.patterns[1].pagePath, '/abs/path/pages/posts/[id].html')
  })

  it('two pages with the same pattern string throw CoraliteBuildError naming both', () => {
    const pages = [
      {
        result: {
          page: {
            routePattern: '/posts/:id',
            routeParams: ['id'],
            routeSegments: [
              {
                type: 'static',
                value: 'posts'
              },
              {
                type: 'param',
                value: 'id'
              }
            ],
            file: {
              pathname: '/abs/path/pages/posts/[id].html'
            }
          }
        }
      },
      {
        result: {
          page: {
            routePattern: '/posts/:id',
            routeParams: ['id'],
            routeSegments: [
              {
                type: 'static',
                value: 'posts'
              },
              {
                type: 'param',
                value: 'id'
              }
            ],
            file: {
              pathname: '/abs/path/pages/posts/[id]/index.html'
            }
          }
        }
      }
    ]

    assert.throws(() => buildRouteTable(pages), (err) => {
      assert.ok(err instanceof CoraliteBuildError)
      assert.ok(err.message.includes('/abs/path/pages/posts/[id].html'))
      assert.ok(err.message.includes('/abs/path/pages/posts/[id]/index.html'))
      assert.ok(err.message.includes('/posts/:id'))
      return true
    })
  })

  it('two pages with the same segment shape but different param names throw CoraliteBuildError naming both', () => {
    const pages = [
      {
        result: {
          page: {
            routePattern: '/posts/:id',
            routeParams: ['id'],
            routeSegments: [
              {
                type: 'static',
                value: 'posts'
              },
              {
                type: 'param',
                value: 'id'
              }
            ],
            file: {
              pathname: '/abs/path/pages/posts/[id].html'
            }
          }
        }
      },
      {
        result: {
          page: {
            routePattern: '/posts/:slug',
            routeParams: ['slug'],
            routeSegments: [
              {
                type: 'static',
                value: 'posts'
              },
              {
                type: 'param',
                value: 'slug'
              }
            ],
            file: {
              pathname: '/abs/path/pages/posts/[slug].html'
            }
          }
        }
      }
    ]

    assert.throws(() => buildRouteTable(pages), (err) => {
      assert.ok(err instanceof CoraliteBuildError)
      assert.ok(err.message.includes('/abs/path/pages/posts/[id].html'))
      assert.ok(err.message.includes('/abs/path/pages/posts/[slug].html'))
      return true
    })
  })

  it('catch-all pattern and a more-specific static pattern coexist without error', () => {
    const pages = [
      {
        result: {
          page: {
            routePattern: '/docs/:slug*',
            routeParams: ['slug'],
            routeSegments: [
              {
                type: 'static',
                value: 'docs'
              },
              {
                type: 'catchall',
                value: 'slug'
              }
            ],
            file: {
              pathname: '/abs/path/pages/docs/[...slug].html'
            }
          }
        }
      },
      {
        result: {
          page: {
            routePattern: '/docs/api',
            routeParams: [],
            routeSegments: [
              {
                type: 'static',
                value: 'docs'
              },
              {
                type: 'static',
                value: 'api'
              }
            ],
            file: {
              pathname: '/abs/path/pages/docs/api.html'
            }
          }
        }
      }
    ]

    const result = buildRouteTable(pages)
    assert.strictEqual(result.patterns.length, 2)
  })

  it('pages without a routePattern are skipped without error', () => {
    const pages = [
      {
        result: {
          page: null
        }
      },
      {
        result: {
          page: {
            routePattern: '/about',
            routeParams: [],
            routeSegments: [
              {
                type: 'static',
                value: 'about'
              }
            ],
            file: {
              pathname: '/abs/path/pages/about.html'
            }
          }
        }
      }
    ]

    const result = buildRouteTable(pages)
    assert.strictEqual(result.patterns.length, 1)
    assert.strictEqual(result.patterns[0].pattern, '/about')
  })
})

describe('Route table integration in Coralite build', () => {
  const testDir = join(fixturesDir, 'prefix-allowed')

  afterEach(async () => {
    await rm(join(testDir, '.coralite'), {
      recursive: true,
      force: true
    })
    await rm(join(testDir, 'dist'), {
      recursive: true,
      force: true
    })
  })

  it('writes manifest.routes.patterns to manifest.json after build', async () => {
    const app = await createCoralite({
      projectRoot: testDir,
      pages: join(testDir, 'pages'),
      components: join(testDir, 'pages'),
      output: join(testDir, 'dist'),
      mode: 'production'
    })

    await app.build()

    const manifestPath = join(testDir, '.coralite/manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

    assert.ok(manifest.routes)
    assert.ok(Array.isArray(manifest.routes.patterns))
    assert.strictEqual(manifest.routes.patterns.length, 2)

    const patterns = manifest.routes.patterns.map(p => p.pattern)
    assert.ok(patterns.includes('/docs/:slug*'))
    assert.ok(patterns.includes('/docs/api'))
  })

  it('exact collision fixture throws CoraliteBuildError during build', async () => {
    const collisionDir = join(fixturesDir, 'collision-exact')
    const app = await createCoralite({
      projectRoot: collisionDir,
      pages: join(collisionDir, 'pages'),
      components: join(collisionDir, 'pages'),
      output: join(collisionDir, 'dist'),
      mode: 'production'
    })

    await assert.rejects(async () => {
      await app.build()
    }, CoraliteBuildError)

    await rm(join(collisionDir, '.coralite'), {
      recursive: true,
      force: true
    })
    await rm(join(collisionDir, 'dist'), {
      recursive: true,
      force: true
    })
  })

  it('shape collision fixture throws CoraliteBuildError during build', async () => {
    const shapeDir = join(fixturesDir, 'collision-shape')
    const app = await createCoralite({
      projectRoot: shapeDir,
      pages: join(shapeDir, 'pages'),
      components: join(shapeDir, 'pages'),
      output: join(shapeDir, 'dist'),
      mode: 'production'
    })

    await assert.rejects(async () => {
      await app.build()
    }, CoraliteBuildError)

    await rm(join(shapeDir, '.coralite'), {
      recursive: true,
      force: true
    })
    await rm(join(shapeDir, 'dist'), {
      recursive: true,
      force: true
    })
  })
})
