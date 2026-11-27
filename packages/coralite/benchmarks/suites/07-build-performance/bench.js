import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createCoralite } from '../../../lib/index.js'
import { calculateMedian } from '../../utils/stats.js'

const ITERATIONS = 3

/**
 * Writes the fixture files for a synthetic dynamic-route site.
 *
 * @param {Object} fixture - Fixture directories.
 * @param {number} rows - Number of dynamic records to generate.
 * @returns {Promise<void>} Resolves when all fixture files exist.
 */
async function writeFixture (fixture, rows) {
  await fs.mkdir(fixture.dataDir, { recursive: true })
  await fs.mkdir(fixture.pagesDir, { recursive: true })
  await fs.mkdir(fixture.componentsDir, { recursive: true })

  for (let index = 0; index < rows; index++) {
    const id = `item-${String(index).padStart(5, '0')}`
    const record = { title: `Item ${index}`, revision: 'r1' }
    await fs.writeFile(path.join(fixture.dataDir, `${id}.json`), JSON.stringify(record))
  }

  const pageSource = `<!DOCTYPE html>
<html lang="en">
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
      .sort()
      .map(function (file) { return { id: file.replace('.json', '') } })
  }

  export async function server ({ route, app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const raw = await fs.readFile(path.join(app.options.projectRoot, 'data', route.params.id + '.json'), 'utf8')
    const record = JSON.parse(raw)
    globalThis.__coralite__.bench.serverCalls++
    return { title: record.title, revision: record.revision }
  }

  export function preRenderKey ({ route }) {
    return route.params.id + ':' + globalThis.__coralite__.bench.revisions[route.params.id]
  }

  export function cacheKey ({ route, state }) {
    return route.params.id + ':' + state.revision
  }
</script>`

  await fs.mkdir(path.join(fixture.pagesDir, 'products'), { recursive: true })
  await fs.writeFile(path.join(fixture.pagesDir, 'products', '[id].html'), pageSource)
  await fs.writeFile(path.join(fixture.pagesDir, 'index.html'), '<!DOCTYPE html><html lang="en"><head><title>Home</title></head><body><h1>Home</h1></body></html>')
  await fs.writeFile(path.join(fixture.pagesDir, 'about.html'), '<!DOCTYPE html><html lang="en"><head><title>About</title></head><body><h1>About</h1></body></html>')
}

/**
 * Counts emitted HTML files without including them in the timed region.
 *
 * @param {string} directory - Output directory.
 * @returns {Promise<number>} Number of HTML files.
 */
async function countHtmlFiles (directory) {
  let count = 0
  const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      count++
    }
  }
  return count
}

/**
 * Reads the manifest size without including it in the timed region.
 *
 * @param {string} cacheDir - Cache directory holding manifest.json.
 * @returns {Promise<number>} Manifest size in bytes.
 */
async function readManifestBytes (cacheDir) {
  try {
    const stats = await fs.stat(path.join(cacheDir, 'manifest.json'))
    return stats.size
  } catch {
    return 0
  }
}

/**
 * Writes rendered pages and generated assets the way the production CLI does.
 *
 * @param {Object} app - Coralite instance from this build.
 * @param {Object[]} results - Build results.
 * @param {Object} fixture - Fixture directories.
 * @returns {Promise<void>} Resolves when all outputs exist on disk.
 */
async function writeOutputs (app, results, fixture) {
  for (const result of results) {
    if (result.status === 'skipped' || typeof result.content !== 'string') {
      continue
    }
    const relativeDir = path.relative(fixture.pagesDir, result.path.dirname)
    const outFile = path.join(fixture.outputDir, relativeDir, result.path.filename)
    await fs.mkdir(path.dirname(outFile), { recursive: true })
    await fs.writeFile(outFile, result.content)
  }

  for (const file of Object.values(app.outputFiles || {})) {
    const isCss = (file.path || file.hashedPath || '').endsWith('.css')
    const baseDir = path.join(fixture.outputDir, 'assets', isCss ? 'css' : 'js')
    const outFile = file.outputDir
      ? path.join(fixture.outputDir, file.outputDir, file.hashedPath)
      : path.join(baseDir, file.hashedPath)
    await fs.mkdir(path.dirname(outFile), { recursive: true })
    const contents = file.contents !== undefined ? file.contents : file.text
    await fs.writeFile(outFile, contents)
  }
}

/**
 * Runs one production build through a fresh Coralite instance.
 *
 * @param {Object} fixture - Fixture directories.
 * @returns {Promise<Object>} Raw metrics for this build.
 */
async function runBuild (fixture) {
  globalThis.__coralite__.bench.serverCalls = 0
  const app = await createCoralite({
    components: fixture.componentsDir,
    pages: fixture.pagesDir,
    output: fixture.outputDir,
    projectRoot: fixture.root,
    cacheDir: fixture.cacheDir,
    mode: 'production',
    incremental: true
  })

  try {
    const started = performance.now()
    const results = await app.build()
    const wallMs = performance.now() - started
    await writeOutputs(app, results, fixture)

    return {
      wallMs,
      serverCalls: globalThis.__coralite__.bench.serverCalls,
      skippedPages: results.filter(result => result.status === 'skipped').length,
      renderedPages: results.filter(result => result.status !== 'skipped').length,
      manifestBytes: await readManifestBytes(fixture.cacheDir),
      outputHtmlFiles: await countHtmlFiles(fixture.outputDir)
    }
  } finally {
    await app.clearCache(true)
  }
}

/**
 * Reduces raw samples to median values with friendly numeric precision.
 *
 * @param {Object[]} samples - Raw build samples.
 * @returns {Object} Summarized metrics.
 */
function summarize (samples) {
  const median = key => +calculateMedian(samples.map(sample => sample[key])).toFixed(1)

  return {
    wallMs: median('wallMs'),
    serverCalls: Math.round(median('serverCalls')),
    skippedPages: Math.round(median('skippedPages')),
    renderedPages: Math.round(median('renderedPages')),
    manifestBytes: Math.round(median('manifestBytes')),
    outputHtmlFiles: Math.round(median('outputHtmlFiles'))
  }
}

/**
 * Measures cold, warm and one-record-change builds on a synthetic site.
 *
 * @param {Object} options - Suite options.
 * @param {number} [options.rows] - Number of dynamic records to generate.
 * @returns {Promise<Object>} Scenario metrics keyed by scenario name.
 */
export async function runBuildPerformanceSuite ({ rows = 2000 } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'coralite-build-bench-'))
  const coraliteGlobal = globalThis.__coralite__ || (globalThis.__coralite__ = {})
  coraliteGlobal.bench = { serverCalls: 0, revisions: {} }
  for (let index = 0; index < rows; index++) {
    coraliteGlobal.bench.revisions[`item-${String(index).padStart(5, '0')}`] = 'r1'
  }

  const fixture = {
    root,
    dataDir: path.join(root, 'data'),
    pagesDir: path.join(root, 'pages'),
    componentsDir: path.join(root, 'components'),
    outputDir: path.join(root, 'dist'),
    cacheDir: path.join(root, '.coralite')
  }

  try {
    await writeFixture(fixture, rows)

    const cold = await runBuild(fixture)

    const warmSamples = []
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      warmSamples.push(await runBuild(fixture))
    }

    const changeSamples = []
    for (let iteration = 0; iteration < ITERATIONS; iteration++) {
      const recordPath = path.join(fixture.dataDir, 'item-00000.json')
      const record = JSON.parse(await fs.readFile(recordPath, 'utf8'))
      record.revision = `change-${iteration}`
      await fs.writeFile(recordPath, JSON.stringify(record))
      coraliteGlobal.bench.revisions['item-00000'] = record.revision
      changeSamples.push(await runBuild(fixture))
    }

    return {
      cold: { ...summarize([cold]), rows },
      warm: { ...summarize(warmSamples), rows },
      oneRecordChange: { ...summarize(changeSamples), rows }
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}
