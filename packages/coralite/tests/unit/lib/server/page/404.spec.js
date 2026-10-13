import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite, CoraliteBuildError } from '#lib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '../../../../fixtures/pages')

let TEST_DIR
let COMPONENTS_DIR
let PAGES_DIR
let OUTPUT_DIR

describe('404 Convention (P2.10)', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-404-test-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    PAGES_DIR = join(TEST_DIR, 'pages')
    OUTPUT_DIR = join(TEST_DIR, 'dist')

    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(PAGES_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('pages/404.html builds to dist/404.html with cleanUrls: true', async () => {
    const fixtureDir = join(FIXTURES_DIR, '404-convention')
    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: fixtureDir,
      output: OUTPUT_DIR,
      cleanUrls: true,
      mode: 'production',
      incremental: false
    })

    await app.save()

    const fourOhFourExists = await readFile(join(OUTPUT_DIR, '404.html'), 'utf8').catch(() => null)
    assert.ok(fourOhFourExists, 'pages/404.html must build to dist/404.html under cleanUrls: true')
    assert.ok(fourOhFourExists.includes('CUSTOM 404 PAGE'), 'Rendered getters and state must be present')

    // Verify route object
    const buildResults = await app.build()
    const fourOhFourBuild = buildResults.find(r => r.path.filename === '404.html' && r.path.pathname.endsWith('404.html'))
    assert.ok(fourOhFourBuild, '404 build result must exist')
    assert.deepEqual(fourOhFourBuild.route, {
      path: '/404',
      pattern: '/404',
      params: {},
      dynamic: false
    })
  })

  it('pages/404.html builds to dist/404.html with cleanUrls: false', async () => {
    const fixtureDir = join(FIXTURES_DIR, '404-convention')
    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: fixtureDir,
      output: OUTPUT_DIR,
      cleanUrls: false,
      mode: 'production',
      incremental: false
    })

    await app.save()

    const fourOhFourExists = await readFile(join(OUTPUT_DIR, '404.html'), 'utf8').catch(() => null)
    assert.ok(fourOhFourExists, 'pages/404.html must build to dist/404.html under cleanUrls: false')

    // Verify route object receives path: '/404' even when cleanUrls is false
    const buildResults = await app.build()
    const fourOhFourBuild = buildResults.find(r => r.path.filename === '404.html' && !r.path.pathname.includes('blog'))
    assert.ok(fourOhFourBuild, '404 build result must exist')
    assert.deepEqual(fourOhFourBuild.route, {
      path: '/404',
      pattern: '/404',
      params: {},
      dynamic: false
    })
  })

  it('404 page is excluded from route table and matching validation', async () => {
    const fixtureDir = join(FIXTURES_DIR, '404-convention')
    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: fixtureDir,
      output: OUTPUT_DIR,
      cleanUrls: true,
      mode: 'production',
      incremental: false
    })

    await app.build()
    // Find manifest from build
    const manifestPath = join(app.options.projectRoot, '.coralite', 'manifest.json')
    const manifestContent = JSON.parse(await readFile(manifestPath, 'utf8'))

    const patterns = manifestContent.routes.patterns.map(p => p.pattern)
    assert.ok(!patterns.includes('/404'), '404 page must not be present in manifest.routes.patterns')

    // Physical manifest must contain dist/404.html
    const physicalKeys = Object.keys(manifestContent.physical)
    assert.ok(physicalKeys.some(k => k.endsWith('404.html')), 'Physical manifest must contain 404.html output path')
  })

  it('pages/blog/404.html is an ordinary page and unaffected by 404 convention', async () => {
    const fixtureDir = join(FIXTURES_DIR, '404-convention')
    const appClean = await createCoralite({
      components: COMPONENTS_DIR,
      pages: fixtureDir,
      output: OUTPUT_DIR,
      cleanUrls: true,
      mode: 'production',
      incremental: false
    })

    await appClean.save()

    const blog404CleanExists = await readFile(join(OUTPUT_DIR, 'blog', '404', 'index.html'), 'utf8').catch(() => null)
    assert.ok(blog404CleanExists, 'blog/404.html must produce dist/blog/404/index.html under cleanUrls: true')

    const cleanBuilds = await appClean.build()
    const blog404CleanBuild = cleanBuilds.find(r => r.path.pathname.includes('blog'))
    assert.equal(blog404CleanBuild.route.path, '/blog/404')

    // Test cleanUrls: false
    const OUTPUT_DIR_FALSE = join(TEST_DIR, 'dist-false')
    const appFile = await createCoralite({
      components: COMPONENTS_DIR,
      pages: fixtureDir,
      output: OUTPUT_DIR_FALSE,
      cleanUrls: false,
      mode: 'production',
      incremental: false
    })

    await appFile.save()

    const blog404FileExists = await readFile(join(OUTPUT_DIR_FALSE, 'blog', '404.html'), 'utf8').catch(() => null)
    assert.ok(blog404FileExists, 'blog/404.html must produce dist/blog/404.html under cleanUrls: false')

    const fileBuilds = await appFile.build()
    const blog404FileBuild = fileBuilds.find(r => r.path.pathname.includes('blog'))
    assert.equal(blog404FileBuild.route.path, '/blog/404.html')
  })

  it('fixture without 404 page builds without producing a 404 file', async () => {
    const fixtureDir = join(FIXTURES_DIR, 'no-404')
    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: fixtureDir,
      output: OUTPUT_DIR,
      cleanUrls: true,
      mode: 'production',
      incremental: false
    })

    await app.save()

    const fourOhFourExists = await readFile(join(OUTPUT_DIR, '404.html'), 'utf8').catch(() => null)
    assert.equal(fourOhFourExists, null, 'No 404 file must be produced if pages/404.html does not exist')
  })

  it('collision between enumerated 404 and pages/404.html throws CoraliteBuildError (cleanUrls: false)', async () => {
    // Set up pages with root 404.html and dynamic [id].html that enumerates '404'
    await writeFile(join(PAGES_DIR, '404.html'), '<h1>Root 404</h1>')
    await writeFile(
      join(PAGES_DIR, '[id].html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          paths () {
            return [{ id: '404' }]
          }
        })
      </script>
      <h1>Dynamic {{ route.params.id }}</h1>`
    )

    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: PAGES_DIR,
      output: OUTPUT_DIR,
      cleanUrls: false,
      mode: 'production',
      incremental: false
    })

    await assert.rejects(
      async () => {
        await app.build()
      },
      (err) => {
        assert.ok(err instanceof CoraliteBuildError)
        assert.ok(err.message.includes('Output path collision detected'))
        assert.ok(err.message.includes('404.html'))
        return true
      }
    )
  })

  it('404 page server(), getters, style, provide, and client blocks execute normally', async () => {
    const fixtureDir = join(FIXTURES_DIR, '404-convention')
    const app = await createCoralite({
      components: COMPONENTS_DIR,
      pages: fixtureDir,
      output: OUTPUT_DIR,
      cleanUrls: true,
      mode: 'production',
      incremental: false
    })

    const buildResults = await app.build()
    const fourOhFourResult = buildResults.find(r => r.path.filename === '404.html' && !r.path.pathname.includes('blog'))

    assert.ok(fourOhFourResult, '404 page build result must exist')
    assert.ok(fourOhFourResult.content.includes('<h1>CUSTOM 404 PAGE</h1>'), 'Getter formattedMessage must be rendered')
    assert.ok(fourOhFourResult.content.includes('<p>Requested: /404</p>'), 'Route path /404 must be rendered')
    assert.ok(fourOhFourResult.content.includes('--bg-color'), 'Style block must apply inline style property')
  })
})
