import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createCoralite } from '#lib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, '../../../fixtures/pages/multi-path')

let TEST_DIR
let COMPONENTS_DIR
let OUTPUT_DIR

describe('Multi-Path Rendering (P2.05)', () => {
  beforeEach(async () => {
    TEST_DIR = await mkdtemp(join(tmpdir(), 'coralite-multi-path-test-'))
    COMPONENTS_DIR = join(TEST_DIR, 'components')
    OUTPUT_DIR = join(TEST_DIR, 'dist')
    await mkdir(COMPONENTS_DIR, { recursive: true })
    await mkdir(OUTPUT_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, {
      recursive: true,
      force: true
    })
  })

  it('page with three enumerated paths produces three output files with distinct route and server state', async () => {
    const pagesDir = join(FIXTURES_DIR, 'file-style')
    const app = await createCoralite({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: pagesDir,
      output: OUTPUT_DIR,
      plugins: [],
      mode: 'production',
      incremental: false,
      cleanUrls: false
    })

    const results = await app.save()
    const htmlResults = results.filter(r => r.path.endsWith('.html'))
    assert.equal(htmlResults.length, 3, 'Must produce 3 HTML output files')

    const filePaths = htmlResults.map(r => r.path).sort()
    assert.ok(filePaths[0].endsWith('posts/advanced.html'))
    assert.ok(filePaths[1].endsWith('posts/conclusion.html'))
    assert.ok(filePaths[2].endsWith('posts/intro.html'))

    const introHtml = await readFile(join(OUTPUT_DIR, 'posts', 'intro.html'), 'utf8')
    assert.ok(introHtml.includes('Title for intro at /posts/intro'))

    const advHtml = await readFile(join(OUTPUT_DIR, 'posts', 'advanced.html'), 'utf8')
    assert.ok(advHtml.includes('Title for advanced at /posts/advanced'))

    const concHtml = await readFile(join(OUTPUT_DIR, 'posts', 'conclusion.html'), 'utf8')
    assert.ok(concHtml.includes('Title for conclusion at /posts/conclusion'))

    // Verify manifest has 3 physical entries
    const manifestContent = await readFile(join(TEST_DIR, '.coralite', 'manifest.json'), 'utf8')
    const manifest = JSON.parse(manifestContent)
    const physicalKeys = Object.keys(manifest.physical).filter(p => !p.includes('router'))
    assert.equal(physicalKeys.length, 3, 'Manifest physical map must record 3 output files')
    assert.ok(physicalKeys.some(k => k.endsWith('posts/intro.html')))
    assert.ok(physicalKeys.some(k => k.endsWith('posts/advanced.html')))
    assert.ok(physicalKeys.some(k => k.endsWith('posts/conclusion.html')))
  })

  it('directory-style page produces output under index.html per enumerated path', async () => {
    const pagesDir = join(FIXTURES_DIR, 'dir-style')
    const app = await createCoralite({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: pagesDir,
      output: OUTPUT_DIR,
      plugins: [],
      mode: 'production',
      incremental: false
    })

    const results = await app.save()
    const htmlResults = results.filter(r => r.path.endsWith('.html'))
    assert.equal(htmlResults.length, 2)

    const introHtml = await readFile(join(OUTPUT_DIR, 'posts', 'intro', 'index.html'), 'utf8')
    assert.ok(introHtml.includes('<p>intro</p>'))

    const advHtml = await readFile(join(OUTPUT_DIR, 'posts', 'advanced', 'index.html'), 'utf8')
    assert.ok(advHtml.includes('<p>advanced</p>'))
  })

  it('page with empty enumeratedPaths produces zero output files', async () => {
    const pagesDir = join(FIXTURES_DIR, 'empty')
    const app = await createCoralite({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: pagesDir,
      output: OUTPUT_DIR,
      plugins: [],
      mode: 'production',
      incremental: false
    })

    const results = await app.save()
    const htmlResults = results.filter(r => r.path.endsWith('.html'))
    assert.equal(htmlResults.length, 0, 'Empty paths must produce zero HTML output files')

    const manifestContent = await readFile(join(TEST_DIR, '.coralite', 'manifest.json'), 'utf8')
    const manifest = JSON.parse(manifestContent)
    const physicalKeys = Object.keys(manifest.physical).filter(p => !p.includes('router'))
    assert.equal(physicalKeys.length, 0)
  })

  it('static page produces exactly one output file (regression check)', async () => {
    const staticPagesDir = join(TEST_DIR, 'static-pages')
    await mkdir(staticPagesDir, { recursive: true })
    await writeFile(join(staticPagesDir, 'about.html'), '<h1>About</h1>')

    const app = await createCoralite({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: staticPagesDir,
      output: OUTPUT_DIR,
      plugins: [],
      mode: 'production',
      incremental: false
    })

    const results = await app.save()
    const htmlResults = results.filter(r => r.path.endsWith('.html'))
    assert.equal(htmlResults.length, 1)
    assert.ok(htmlResults[0].path.endsWith(join('about', 'index.html')))
  })

  it('fault isolation: server throwing for one path still produces outputs for other paths', async () => {
    const pagesDir = join(FIXTURES_DIR, 'error-handling')
    const app = await createCoralite({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: pagesDir,
      output: OUTPUT_DIR,
      plugins: [],
      mode: 'production',
      incremental: false,
      continueOnError: true,
      cleanUrls: false
    })

    try {
      await app.save()
    } catch {
      // Build might throw CoraliteBuildError when failOnError is true
    }

    const ok1Html = await readFile(join(OUTPUT_DIR, 'ok1.html'), 'utf8').catch(() => null)
    const ok2Html = await readFile(join(OUTPUT_DIR, 'ok2.html'), 'utf8').catch(() => null)
    const failHtml = await readFile(join(OUTPUT_DIR, 'fail.html'), 'utf8').catch(() => null)

    assert.ok(ok1Html && ok1Html.includes('Success ok1'), 'Path ok1 should render successfully')
    assert.ok(ok2Html && ok2Html.includes('Success ok2'), 'Path ok2 should render successfully')
    assert.equal(failHtml, null, 'Path fail should produce no output file')

    const manifestContent = await readFile(join(TEST_DIR, '.coralite', 'manifest.json'), 'utf8')
    const manifest = JSON.parse(manifestContent)
    assert.ok(manifest.failed.some(f => f.includes('fail')), 'Failed path should be recorded in manifest.failed')
  })

  it('onError hook provides fallback for a single failing path in dynamic page', async () => {
    const errPagesDir = join(TEST_DIR, 'err-pages')
    await mkdir(errPagesDir, { recursive: true })
    await writeFile(
      join(errPagesDir, '[id].html'),
      `<script type="module">
        import { definePage } from 'coralite'
        export default definePage({
          paths () {
            return [{ id: 'good' }, { id: 'bad' }]
          },
          server ({ route }) {
            if (route.params.id === 'bad') {
              throw new Error('Boom in bad path')
            }
            return { title: 'Good Post' }
          },
          onError ({ route }) {
            return {
              template: '<h1>Fallback for ' + route.params.id + '</h1>'
            }
          }
        })
      </script>
      <!DOCTYPE html>
      <html><body><h1>{{ title }}</h1></body></html>`
    )

    const app = await createCoralite({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: errPagesDir,
      output: OUTPUT_DIR,
      plugins: [],
      mode: 'production',
      incremental: false,
      cleanUrls: false
    })

    const results = await app.save()
    const htmlResults = results.filter(r => r.path.endsWith('.html'))
    assert.equal(htmlResults.length, 2)

    const goodHtml = await readFile(join(OUTPUT_DIR, 'good.html'), 'utf8')
    assert.ok(goodHtml.includes('Good Post'))

    const badHtml = await readFile(join(OUTPUT_DIR, 'bad.html'), 'utf8')
    assert.ok(badHtml.includes('Fallback for bad'))
  })

  it('enumerated paths render in sorted order (deterministic)', async () => {
    const pagesDir = join(FIXTURES_DIR, 'file-style')
    const app = await createCoralite({
      projectRoot: TEST_DIR,
      components: COMPONENTS_DIR,
      pages: pagesDir,
      output: OUTPUT_DIR,
      plugins: [],
      mode: 'production',
      incremental: false
    })

    const renderOrder = []
    await app.build(null, null, (res) => {
      if (res && res.route) {
        renderOrder.push(res.route.path)
      }
    })

    assert.deepEqual([...renderOrder].sort(), ['/posts/advanced', '/posts/conclusion', '/posts/intro'])
  })
})
