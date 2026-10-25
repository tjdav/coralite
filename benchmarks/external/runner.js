/**
 * External benchmark runner orchestrator.
 *
 * Usage:
 *   pnpm bench:external              run all registered adapters
 *   pnpm bench:external jfb          run only js-framework-benchmark
 *   pnpm bench:external --clean      wipe .bench-cache/ and re-clone
 *   pnpm bench:external --save       write results to benchmarks/results/external/
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CACHE_DIR = path.join(ROOT, '.bench-cache')
const RESULTS_DIR = path.join(ROOT, 'benchmarks/results/external')

const ADAPTERS = {
  jfb: () => import('./adapters/js-framework-benchmark.js').then(m => m.default),
  lumeland: () => import('./adapters/lumeland.js').then(m => m.default)
}

/**
 * Logs message to stdout with standard prefix tag.
 * @param {string} tag Prefix tag
 * @param {string} msg Message to log
 */
function log (tag, msg) {
  console.log(`[${tag}] ${msg}`)
}

/**
 * Runs main orchestrator logic.
 */
async function main () {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage:
  node benchmarks/external/runner.js [adapter] [options]

Adapters:
  jfb               js-framework-benchmark
  lumeland          lumeland-benchmark

Options:
  --clean           Remove existing cached clone before running
  --save            Save benchmark results JSON into benchmarks/results/external/
  --help, -h        Show this help message
`)
    process.exit(0)
  }

  const clean = args.includes('--clean')
  const save = args.includes('--save') || args.includes('--save-all')
  const adapterArgs = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'))

  const adapterKeys = adapterArgs.length > 0 ? adapterArgs : Object.keys(ADAPTERS)

  for (const key of adapterKeys) {
    if (!ADAPTERS[key]) {
      console.error(`[error] Unknown benchmark adapter: ${key}`)
      console.error(`[error] Available adapters: ${Object.keys(ADAPTERS).join(', ')}`)
      process.exit(1)
    }
  }

  await fs.mkdir(CACHE_DIR, { recursive: true })

  for (const key of adapterKeys) {
    const getAdapter = ADAPTERS[key]
    const adapter = await getAdapter()

    log('runner', `Starting external benchmark adapter '${adapter.name}'...`)

    const cloneDir = adapter.cloneDir(CACHE_DIR)

    if (clean) {
      log('clone', `Cleaning cached directory at ${cloneDir}...`)
      await fs.rm(cloneDir, {
        recursive: true,
        force: true
      })
    }

    const exists = await fs.stat(cloneDir).then(() => true).catch(() => false)
    if (!exists) {
      log('clone', `Cloning ${adapter.repoUrl} into ${cloneDir}...`)
      const res = spawnSync('git', ['clone', '--depth', '1', adapter.repoUrl, cloneDir], {
        stdio: 'inherit',
        encoding: 'utf8'
      })
      if (res.status !== 0) {
        log('error', `Failed to clone repository ${adapter.repoUrl}`)
        process.exit(1)
      }
    } else {
      log('clone', `Using cached repository at ${cloneDir}`)
    }

    if (Array.isArray(adapter.submissionCopies)) {
      for (const entry of adapter.submissionCopies) {
        const sourcePath = path.join(ROOT, entry.from)
        const targetPath = path.join(cloneDir, entry.to)
        log('copy', `Copying ${entry.from} -> ${entry.to}...`)
        await fs.mkdir(path.dirname(targetPath), { recursive: true })
        await fs.rm(targetPath, {
          recursive: true,
          force: true
        })
        await fs.cp(sourcePath, targetPath, {
          recursive: true,
          force: true,
          verbatimSymlinks: true
        })
      }
    }

    if (typeof adapter.install === 'function') {
      log('install', `Installing dependencies for ${adapter.name}...`)
      await adapter.install(cloneDir, (tag, msg) => log(tag, msg))
    }

    log('run', `Executing benchmark for ${adapter.name}...`)
    const results = await adapter.run(cloneDir, (tag, msg) => log(tag, msg))

    if (save) {
      await fs.mkdir(RESULTS_DIR, { recursive: true })
      const dateStr = new Date().toISOString().split('T')[0]
      const resultPath = path.join(RESULTS_DIR, `${adapter.name}-${dateStr}.json`)
      log('save', `Saving results to ${path.relative(ROOT, resultPath)}...`)
      await fs.writeFile(resultPath, JSON.stringify(results, null, 2), 'utf8')
    }

    if (typeof adapter.cleanup === 'function') {
      await adapter.cleanup(cloneDir, (tag, msg) => log(tag, msg))
    }

    log('runner', `Adapter '${adapter.name}' finished successfully.`)
  }
}

main().catch(err => {
  console.error('[error] Unhandled benchmark runner error:', err)
  process.exit(1)
})
