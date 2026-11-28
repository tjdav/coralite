import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { calculateMedian } from '../../utils/stats.js'

const ENTRIES = 45000
const SHARDS = 16

/**
 * Creates a manifest shaped like a large content site's incremental cache.
 *
 * @param {number} entries - Number of physical page entries.
 * @returns {Object} A populated manifest.
 */
function createLargeManifest (entries) {
  const manifest = {
    version: 2,
    physical: {},
    virtual: {},
    dependencies: {},
    components: {}
  }
  const dependencies = ['x-card', 'x-badge', 'x-price']

  for (let index = 0; index < entries; index++) {
    const key = `/products/product-${index}/index.html`
    manifest.physical[key] = {
      mtime: 1700000000000 + index,
      size: 2048 + index,
      hash: `hash-${index}`,
      cacheKey: `product-${index}:r1`,
      runtimeChunk: 'assets/js/runtime-4f2a9c.js',
      pageScript: `assets/js/pages/product-${index}-a1b2.js`,
      pageScriptHash: `script-${index}`,
      componentHashes: {
        'x-card': `hash-${index}`,
        'x-badge': `hash-${index}`,
        'x-price': `hash-${index}`
      },
      injectedAssets: [{ name: 'meta', dest: `assets/meta/product-${index}.json` }],
      dependencies
    }
  }

  manifest.dependencies = { 'x-card': Object.keys(manifest.physical).slice(0, 1000) }
  manifest.components = {
    'x-card': { hash: 'component-1' },
    'x-badge': { hash: 'component-2' },
    'x-price': { hash: 'component-3' }
  }
  manifest.failed = []
  return manifest
}

/**
 * Measures one strategy for reading and writing a large manifest.
 *
 * @param {Object} options - Measurement options.
 * @param {string} options.root - Temporary directory root.
 * @param {string} options.strategy - Strategy name.
 * @param {Object} options.manifest - Manifest to persist.
 * @param {number} options.iterations - Samples to collect.
 * @returns {Promise<Object>} Median load/save times and total bytes.
 */
async function measureStrategy ({ root, strategy, manifest, iterations }) {
  const cacheDir = path.join(root, strategy)
  await fs.mkdir(cacheDir, { recursive: true })

  const loadSamples = []
  const saveSamples = []
  let bytes = 0

  for (let iteration = 0; iteration < iterations; iteration++) {
    if (strategy === 'legacy') {
      const filePath = path.join(cacheDir, 'manifest.json')
      let started = performance.now()
      await fs.writeFile(filePath, JSON.stringify(manifest, null, 2))
      saveSamples.push(performance.now() - started)

      started = performance.now()
      JSON.parse(await fs.readFile(filePath, 'utf8'))
      loadSamples.push(performance.now() - started)
    } else {
      const { createManifestStore } = await import('../../../lib/server/utils/manifest-store.js')
      const store = createManifestStore({ cacheDir, shards: strategy === 'sharded' ? SHARDS : 1 })
      let started = performance.now()
      await store.save(manifest)
      saveSamples.push(performance.now() - started)

      started = performance.now()
      await store.load()
      loadSamples.push(performance.now() - started)
    }

    if (strategy === 'sharded') {
      const files = await fs.readdir(path.join(cacheDir, 'manifest-shards'))
      const sizes = await Promise.all(files.map(file => fs.stat(path.join(cacheDir, 'manifest-shards', file))))
      bytes = sizes.reduce((total, size) => total + size.size, 0)
    } else {
      bytes = (await fs.stat(path.join(cacheDir, 'manifest.json'))).size
    }
  }

  return {
    loadMs: +calculateMedian(loadSamples).toFixed(1),
    loadSpreadMs: +(Math.max(...loadSamples) - Math.min(...loadSamples)).toFixed(1),
    saveMs: +calculateMedian(saveSamples).toFixed(1),
    saveSpreadMs: +(Math.max(...saveSamples) - Math.min(...saveSamples)).toFixed(1),
    bytes,
    entries: ENTRIES,
    shards: strategy === 'sharded' ? SHARDS : 1
  }
}

/**
 * Benchmarks legacy, compact and sharded manifest storage.
 *
 * @param {Object} options - Suite options.
 * @param {string} [options.store] - Strategy to run: legacy, compact, sharded or all.
 * @param {number} [options.iterations] - Samples per strategy.
 * @returns {Promise<Object>} Strategy metrics.
 */
export async function runManifestStoreSuite ({ store = 'all', iterations = 3 } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'coralite-manifest-bench-'))
  const manifest = createLargeManifest(ENTRIES)
  const strategies = store === 'all' ? ['legacy', 'compact', 'sharded'] : [store]

  try {
    const results = {}
    for (const strategy of strategies) {
      results[strategy] = await measureStrategy({ root, strategy, manifest, iterations })
    }
    return results
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}
