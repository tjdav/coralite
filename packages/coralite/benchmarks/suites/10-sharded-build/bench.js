import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const workerPath = fileURLToPath(new URL('../../scripts/shard-worker.js', import.meta.url))
const ROWS = 2000
const CONCURRENCY = 24

/**
 * Writes the benchmark fixture: a dynamic route and two static pages.
 *
 * @param {Object} fixture - Fixture directories.
 * @param {number} rows - Dynamic records to generate.
 * @returns {Promise<void>} Resolves when the fixture is written.
 */
async function writeFixture (fixture, rows) {
  await fs.mkdir(fixture.dataDir, { recursive: true })
  await fs.mkdir(path.join(fixture.pagesDir, 'products'), { recursive: true })
  await fs.mkdir(fixture.componentsDir, { recursive: true })

  for (let index = 0; index < rows; index++) {
    const id = `item-${String(index).padStart(5, '0')}`
    await fs.writeFile(path.join(fixture.dataDir, `${id}.json`), JSON.stringify({ title: `Item ${index}` }))
  }

  await fs.writeFile(path.join(fixture.pagesDir, 'products', '[id].html'), `<!DOCTYPE html>
<html lang="en"><head><title>{{ title }}</title></head><body><h1>{{ title }}</h1></body></html>
<script type="module">
  export async function paths ({ app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const files = await fs.readdir(path.join(app.options.projectRoot, 'data'))
    return files.filter(function (file) { return file.endsWith('.json') }).sort().map(function (file) { return { id: file.replace('.json', '') } })
  }

  export async function server ({ route, app }) {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const raw = await fs.readFile(path.join(app.options.projectRoot, 'data', route.params.id + '.json'), 'utf8')
    return { title: JSON.parse(raw).title }
  }
</script>`)
  await fs.writeFile(path.join(fixture.pagesDir, 'index.html'), '<!DOCTYPE html><html lang="en"><head><title>Home</title></head><body><h1>Home</h1></body></html>')
  await fs.writeFile(path.join(fixture.pagesDir, 'about.html'), '<!DOCTYPE html><html lang="en"><head><title>About</title></head><body><h1>About</h1></body></html>')
}

/**
 * Runs one shard in a child process.
 *
 * @param {Object} payload - Worker payload.
 * @returns {Promise<number>} Child wall time in milliseconds.
 */
function runWorker (payload) {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    const child = spawn(process.execPath, ['--conditions=development', '--experimental-vm-modules', workerPath, JSON.stringify(payload)], {
      cwd: path.resolve(fileURLToPath(new URL('../../../..', import.meta.url))),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`shard worker exited ${code}: ${stderr}`))
        return
      }
      resolve(performance.now() - started)
    })
  })
}

/**
 * Hashes a directory tree by sorted relative path and file contents.
 *
 * @param {string} directory - Directory to hash.
 * @returns {Promise<{ hash: string, files: number }>} Tree fingerprint.
 */
async function hashTree (directory) {
  const digest = crypto.createHash('sha256')
  let files = 0
  async function walk (current) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        const relative = path.relative(directory, full)
        digest.update(relative)
        digest.update(await fs.readFile(full))
        files++
      }
    }
  }
  await walk(directory)
  return { hash: digest.digest('hex'), files }
}

/**
 * Copies every file from one shard output into a merged tree.
 *
 * @param {string[]} sources - Shard output directories.
 * @param {string} destination - Merged output directory.
 * @returns {Promise<number>} Number of files copied.
 */
async function mergeOutputs (sources, destination) {
  let count = 0
  for (const source of sources) {
    async function walk (current) {
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (entry.isFile()) {
          const target = path.join(destination, path.relative(source, full))
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.copyFile(full, target)
          count++
        }
      }
    }
    await walk(source)
  }
  return count
}

/**
 * Compares a serial cold build with a sharded one.
 *
 * @returns {Promise<Object>} Metrics for the prototype.
 */
export async function runShardedBuildSuite () {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'coralite-shard-bench-'))
  const fixture = {
    root,
    dataDir: path.join(root, 'data'),
    pagesDir: path.join(root, 'pages'),
    componentsDir: path.join(root, 'components')
  }
  const shardCount = Math.min(os.availableParallelism() || 4, 4)
  const allPaths = Array.from({ length: ROWS }, (_, index) => ({ id: `item-${String(index).padStart(5, '0')}` }))

  try {
    await writeFixture(fixture, ROWS)

    const serialOutput = path.join(root, 'dist-serial')
    const serialPayload = {
      ...fixture,
      outputDir: serialOutput,
      cacheDir: path.join(root, '.coralite', 'serial'),
      dynamicPaths: allPaths,
      concurrency: CONCURRENCY
    }
    const serialMs = await runWorker(serialPayload)
    const serialTree = await hashTree(serialOutput)

    const payloads = Array.from({ length: shardCount }, (_, index) => ({
      ...fixture,
      outputDir: path.join(root, 'dist-shard', String(index)),
      cacheDir: path.join(root, '.coralite', `shard-${index}`),
      dynamicPaths: allPaths.filter((_, pathIndex) => pathIndex % shardCount === index),
      concurrency: 1
    }))

    const started = performance.now()
    const shards = await Promise.all(payloads.map(payload => runWorker(payload)))
    const mergedOutput = path.join(root, 'dist-merged')
    await mergeOutputs(shardOutputsFrom(payloads), mergedOutput)
    const shardedMs = performance.now() - started
    const shardedTree = await hashTree(mergedOutput)

    return {
      serialMs: +serialMs.toFixed(1),
      shardedMs: +shardedMs.toFixed(1),
      speedup: +(serialMs / shardedMs).toFixed(2),
      shards: shardCount,
      outputMatch: serialTree.hash === shardedTree.hash,
      serialFiles: serialTree.files,
      mergedFiles: shardedTree.files,
      shardWallTimes: shards.map(value => +value.toFixed(1)).join(', ')
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

function shardOutputsFrom (payloads) {
  return payloads.map(payload => payload.outputDir)
}
