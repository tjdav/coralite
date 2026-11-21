import { describe, it, beforeEach, afterEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { join } from 'node:path'
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises'
import { createTestProject } from '../utils/project.js'
import { virtualPagePlugin } from '../utils/virtual-page-plugin.js'

const MANIFEST_VERSION = 2

/**
 * Builds the page source used by the data-driven dynamic tests.
 *
 * @param {{ cacheKey?: string }} [options] - Optional page handler additions.
 * @returns {string} Page HTML.
 */
function dataDrivenPage (options = {}) {
  return `<!DOCTYPE html>
<html>
<head><title>{{ title }}</title></head>
<body><h1>{{ title }}</h1></body>
</html>

<script type="module">
  export async function paths ({ app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const files = await fs.readdir(path.join(app.options.projectRoot, 'data'))
    return files
      .filter(function (file) { return file.endsWith('.json') })
      .map(function (file) { return { id: file.replace('.json', '') } })
  }

  export async function server ({ route, app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const raw = await fs.readFile(path.join(app.options.projectRoot, 'data', route.params.id + '.json'), 'utf8')
    const record = JSON.parse(raw)
    return { title: record.title, revision: record.revision }
  }

  ${options.cacheKey || ''}
</script>`
}

describe('Route-aware incremental builds', () => {
  let project
  let dataDir

  const writeRecord = (name, record) => {
    return writeFile(join(dataDir, `${name}.json`), JSON.stringify(record))
  }

  beforeEach(async () => {
    project = await createTestProject()
    dataDir = join(project.testDir, 'data')
    await mkdir(dataDir, { recursive: true })
  })

  afterEach(async () => {
    await project.cleanup()
  })

  it('rebuilds only the dynamic output whose server data changed', async () => {
    await writeRecord('alpha', {
      title: 'Alpha v1',
      revision: 'r1'
    })
    await writeRecord('beta', {
      title: 'Beta v1',
      revision: 'r1'
    })
    await mkdir(join(project.pagesDir, 'posts'), { recursive: true })
    await project.writePage('posts/[id].html', dataDrivenPage())

    const coralite = await project.createCoralite({ output: undefined })
    const first = await coralite.build()
    assert.equal(first.length, 2)
    assert.ok(first.every(result => result.status === undefined))

    await writeRecord('alpha', {
      title: 'Alpha v2',
      revision: 'r1'
    })
    const second = await coralite.build()

    const alpha = second.find(result => result.route?.params?.id === 'alpha')
    const beta = second.find(result => result.route?.params?.id === 'beta')

    assert.equal(alpha.status, undefined)
    assert.ok(alpha.content.includes('Alpha v2'))
    assert.equal(beta.status, 'skipped')
    assert.equal(beta.content, undefined)
  })

  it('uses a cacheKey() override instead of serialized state', async () => {
    await writeRecord('alpha', {
      title: 'Alpha v1',
      revision: 'r1'
    })
    await mkdir(join(project.pagesDir, 'posts'), { recursive: true })
    await project.writePage(
      'posts/[id].html',
      dataDrivenPage({ cacheKey: 'export function cacheKey ({ state }) { return state.revision }' })
    )

    const coralite = await project.createCoralite({ output: undefined })
    await coralite.build()

    await writeRecord('alpha', {
      title: 'Alpha v2',
      revision: 'r1'
    })
    const skipped = await coralite.build()
    assert.equal(skipped[0].status, 'skipped')

    await writeRecord('alpha', {
      title: 'Alpha v3',
      revision: 'r2'
    })
    const rebuilt = await coralite.build()
    assert.equal(rebuilt[0].status, undefined)
    assert.ok(rebuilt[0].content.includes('Alpha v3'))
  })

  it('keys outputs independently with cleanUrls and locale params', async () => {
    await writeRecord('en-alpha', {
      title: 'Alpha EN',
      revision: 'r1'
    })
    await writeRecord('es-alpha', {
      title: 'Alpha ES',
      revision: 'r1'
    })
    await mkdir(join(project.pagesDir, '[locale]', 'posts'), { recursive: true })

    const localePage = `<!DOCTYPE html>
<html>
<head><title>{{ title }}</title></head>
<body><h1>{{ title }}</h1></body>
</html>

<script type="module">
  export async function paths ({ app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const files = await fs.readdir(path.join(app.options.projectRoot, 'data'))
    return files
      .filter(function (file) { return file.endsWith('.json') })
      .map(function (file) {
        const parts = file.replace('.json', '').split('-')
        return { locale: parts[0], id: parts.slice(1).join('-') }
      })
  }

  export async function server ({ route, app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const raw = await fs.readFile(path.join(app.options.projectRoot, 'data', route.params.locale + '-' + route.params.id + '.json'), 'utf8')
    const record = JSON.parse(raw)
    return { title: record.title, revision: record.revision }
  }
</script>`

    await project.writePage('[locale]/posts/[id].html', localePage)

    const coralite = await project.createCoralite({ cleanUrls: true })
    await coralite.save()

    await writeRecord('es-alpha', {
      title: 'Alpha ES v2',
      revision: 'r1'
    })
    const saved = await coralite.save()
    const savedFiles = saved.map(entry => entry.path)
    const esOutput = join('es', 'posts', 'alpha', 'index.html')
    const enOutput = join('en', 'posts', 'alpha', 'index.html')

    assert.ok(savedFiles.some(file => file.endsWith(esOutput)), 'Changed locale output should be written')
    assert.ok(!savedFiles.some(file => file.endsWith(enOutput)), 'Unchanged locale output should stay skipped')
    assert.ok((await readFile(join(project.outputDir, esOutput), 'utf8')).includes('Alpha ES v2'))
  })

  it('adds and removes outputs when paths() entries change', async () => {
    await writeRecord('alpha', {
      title: 'Alpha',
      revision: 'r1'
    })
    await writeRecord('beta', {
      title: 'Beta',
      revision: 'r1'
    })
    await mkdir(join(project.pagesDir, 'posts'), { recursive: true })
    await project.writePage('posts/[id].html', dataDrivenPage())

    const coralite = await project.createCoralite({ output: undefined })
    await coralite.build()

    await writeRecord('gamma', {
      title: 'Gamma',
      revision: 'r1'
    })
    const addedApp = await project.createCoralite({ output: undefined })
    const added = await addedApp.build()
    const gamma = added.find(result => result.route?.params?.id === 'gamma')
    assert.ok(gamma)
    assert.equal(gamma.status, undefined)
    assert.equal(added.find(result => result.route?.params?.id === 'alpha').status, 'skipped')

    await unlink(join(dataDir, 'beta.json'))
    const removedApp = await project.createCoralite({ output: undefined })
    const removed = await removedApp.build()
    assert.equal(removed.find(result => result.route?.params?.id === 'beta'), undefined)

    const manifest = JSON.parse(await readFile(join(project.testDir, '.coralite', 'manifest.json'), 'utf8'))
    const manifestPaths = Object.keys(manifest.physical)
    assert.ok(manifestPaths.some(path => path.endsWith(join('posts', 'alpha', 'index.html'))))
    assert.ok(manifestPaths.some(path => path.endsWith(join('posts', 'gamma', 'index.html'))))
    assert.ok(!manifestPaths.some(path => path.endsWith(join('posts', 'beta', 'index.html'))))
  })

  it('invalidates stale manifests when the version changes', async () => {
    await project.writePage('index.html', '<h1>Home</h1>')
    const coralite = await project.createCoralite()
    await coralite.build()

    const manifestPath = join(project.testDir, '.coralite', 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    assert.equal(manifest.version, MANIFEST_VERSION)

    delete manifest.version
    await writeFile(manifestPath, JSON.stringify(manifest))

    const results = await coralite.build()
    assert.equal(results[0].status, undefined)

    const rewritten = JSON.parse(await readFile(manifestPath, 'utf8'))
    assert.equal(rewritten.version, MANIFEST_VERSION)
  })

  it('opts a static page into cacheKey() invalidation', async () => {
    await writeRecord('alpha', {
      title: 'Static v1',
      revision: 'r1'
    })
    await project.writePage('index.html', `<!DOCTYPE html>
<html><head><title>{{ title }}</title></head><body><h1>{{ title }}</h1></body></html>
<script type="module">
  export async function server ({ app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const raw = await fs.readFile(path.join(app.options.projectRoot, 'data', 'alpha.json'), 'utf8')
    const record = JSON.parse(raw)
    return { title: record.title, revision: record.revision }
  }

  export function cacheKey ({ state }) { return state.revision }
</script>`)

    const coralite = await project.createCoralite({ output: undefined })
    await coralite.build()

    await writeRecord('alpha', {
      title: 'Static v2',
      revision: 'r1'
    })
    const skipped = await coralite.build()
    assert.equal(skipped[0].status, 'skipped')

    await writeRecord('alpha', {
      title: 'Static v3',
      revision: 'r2'
    })
    const rebuilt = await coralite.build()
    assert.equal(rebuilt[0].status, undefined)
    assert.ok(rebuilt[0].content.includes('Static v3'))
  })

  it('fails the page when cacheKey() returns an invalid type', async () => {
    await writeRecord('alpha', {
      title: 'Alpha',
      revision: 'r1'
    })
    await mkdir(join(project.pagesDir, 'posts'), { recursive: true })
    await project.writePage(
      'posts/[id].html',
      dataDrivenPage({ cacheKey: 'export function cacheKey () { return { invalid: true } }' })
    )

    const coralite = await project.createCoralite({ output: undefined })
    await assert.rejects(
      () => coralite.build(),
      (error) => {
        assert.ok(error.message.includes('cacheKey() must return a string or number'))
        const failedPage = error.failedPages && error.failedPages[0]
        assert.ok(failedPage && failedPage.error && failedPage.error.message.includes('cacheKey() must return a string or number'))
        return true
      }
    )
  })

  it('accepts a revision alias for virtual pagination entries', async () => {
    const options = {
      content: '<h1>Virtual page</h1>',
      revision: 'v1'
    }
    const plugin = virtualPagePlugin('virtual.html', options)
    const coralite = await project.createCoralite({
      plugins: [plugin],
      output: undefined
    })

    await coralite.build()
    const skipped = await coralite.build()
    assert.equal(skipped.find(result => result.path.pathname.includes('virtual')).status, 'skipped')

    options.revision = 'v2'
    const rebuilt = await coralite.build()
    assert.equal(rebuilt.find(result => result.path.pathname.includes('virtual')).status, undefined)
  })
})
