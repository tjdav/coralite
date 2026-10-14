import process from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { printTerminalResults, writeJSONResults, writeMarkdownResults } from './utils/reporter.js'
import { triggerGC } from './utils/memory.js'
import { compareAgainstBaseline, DEFAULT_BASELINE_PATH } from './utils/regression.js'
import { runDomReactivitySuite } from './suites/01-dom-reactivity/bench.js'
import { runBundleHydrationSuite } from './suites/02-bundle-hydration/bench.js'
import { runSSRThroughputSuite } from './suites/03-ssr-throughput/bench.js'
import { runInternalSuite } from './suites/04-internal/bench.js'
import { runStressLifecycleSuite } from './suites/05-stress-lifecycle/bench.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Parses command line arguments.
 *
 * @returns {Object} Parsed CLI options.
 */
function parseArgs () {
  const args = process.argv.slice(2)
  const flags = {
    help: false,
    suite: 'all',
    json: false,
    iterations: 9,
    rows: 1000,
    checkRegression: false,
    warnOnly: false,
    saveBaseline: false,
    taskId: 'adhoc',
    phase: 'after',
    save: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      flags.help = true
    } else if (arg.startsWith('--suite=')) {
      flags.suite = arg.split('=')[1]
    } else if (arg === '-s' && i + 1 < args.length) {
      flags.suite = args[++i]
    } else if (arg.startsWith('--task-id=')) {
      flags.taskId = arg.split('=')[1]
    } else if (arg === '--task-id' && i + 1 < args.length) {
      flags.taskId = args[++i]
    } else if (arg.startsWith('--phase=')) {
      flags.phase = arg.split('=')[1]
    } else if (arg === '--phase' && i + 1 < args.length) {
      flags.phase = args[++i]
    } else if (arg === '--save') {
      flags.save = true
    } else if (arg === '--json') {
      flags.json = true
    } else if (arg === '--check-regression') {
      flags.checkRegression = true
    } else if (arg === '--warn-only') {
      flags.warnOnly = true
    } else if (arg === '--save-baseline') {
      flags.saveBaseline = true
    } else if (arg.startsWith('--iterations=')) {
      flags.iterations = parseInt(arg.split('=')[1], 10) || 9
    } else if (arg === '-i' && i + 1 < args.length) {
      flags.iterations = parseInt(args[++i], 10) || 9
    } else if (arg.startsWith('--rows=')) {
      flags.rows = parseInt(arg.split('=')[1], 10) || 1000
    } else if (arg === '-r' && i + 1 < args.length) {
      flags.rows = parseInt(args[++i], 10) || 1000
    }
  }

  return flags
}

/**
 * Prints usage CLI help text.
 */
function printHelp () {
  console.log(`
Coralite Benchmark Runner CLI

Usage:
  node --expose-gc --experimental-vm-modules ./benchmarks/runner.js [options]

Options:
  --help, -h          Display formatted CLI usage and exit
  --suite=<name>, -s  Run a specific benchmark suite (dom-reactivity, bundle-hydration, ssr-throughput, internal, stress, or all [default: all])
  --task-id=<id>      Identifier for the result file (default: adhoc)
  --phase=<phase>     Phase of run: before, after, baseline (default: after)
  --save              Write results to benchmarks/results/<task-id>.json
  --json              Write benchmark results to packages/coralite/benchmarks/results/latest.json
  --check-regression  Compare run against baseline.json and exit with code 1 on regression
  --warn-only         Print regression warnings without exiting with code 1
  --save-baseline     Save current run results to baselines/baseline.json
  --iterations=<n>, -i Set iteration count per test (default: 9)
  --rows=<n>, -r      Set row count for DOM reactivity suite (default: 1000)
`)
}

/**
 * Captures host machine metadata.
 *
 * @returns {Object} Machine metadata object.
 */
function getMachineInfo () {
  let cpu = null
  let cores = null
  let osName = null

  try {
    const cpus = os.cpus()
    if (cpus && cpus.length > 0) {
      cpu = cpus[0].model || null
      cores = cpus.length
    }
  } catch {}

  try {
    osName = `${os.type()} ${os.release()}`
  } catch {}

  return {
    cpu,
    cores,
    os: osName,
    nodeVersion: process.version || null
  }
}

/**
 * Resolves the current short git commit hash.
 *
 * @returns {string} Short commit hash or 'unknown'.
 */
function getCommitHash () {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Formats raw benchmark metrics into the standard task result schema.
 *
 * @param {Object} resultsData - Raw benchmark execution metrics.
 * @param {string} taskId - Identifier for the performance task.
 * @param {string} phase - Benchmark phase (before, after, baseline).
 * @returns {Object} Schema-compliant result object.
 */
function formatTaskResults (resultsData, taskId, phase) {
  const domRaw = resultsData.suites?.['dom-reactivity']?.coralite
  const bundleRaw = resultsData.suites?.['bundle-hydration']?.coraliteDynamic
  const ssrRaw = resultsData.suites?.ssrThroughput

  const results = {}

  if (domRaw) {
    results['dom-reactivity'] = {
      create1k: domRaw.create1k,
      replace1k: domRaw.replace1k,
      update10th: domRaw.update10th,
      swapRows: domRaw.swapRows,
      clear: domRaw.clear,
      heapMB: domRaw.heapMB
    }
  }

  if (bundleRaw) {
    results['bundle-hydration'] = {
      rawJsKb: bundleRaw.rawKB,
      gzipJsKb: bundleRaw.gzipKB,
      hydrationMs: bundleRaw.hydrationMS,
      ttiMs: bundleRaw.ttiMS
    }
  }

  if (ssrRaw) {
    results.ssrThroughput = {
      100: {
        durationMs: ssrRaw['100_pages']?.totalDurationMS,
        throughputPagesPerSec: ssrRaw['100_pages']?.pagesPerSec
      },
      1000: {
        durationMs: ssrRaw['1000_pages']?.totalDurationMS,
        throughputPagesPerSec: ssrRaw['1000_pages']?.pagesPerSec
      },
      10000: {
        durationMs: ssrRaw['10000_pages']?.totalDurationMS,
        throughputPagesPerSec: ssrRaw['10000_pages']?.pagesPerSec
      }
    }
  }

  return {
    taskId,
    phase,
    commit: getCommitHash(),
    runAt: resultsData.timestamp,
    machine: getMachineInfo(),
    results
  }
}

/**
 * Main benchmark execution entry point.
 *
 * @returns {Promise<void>}
 */
async function main () {
  const flags = parseArgs()

  if (flags.help) {
    printHelp()
    process.exit(0)
  }

  triggerGC()

  const resultsData = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    suites: {}
  }

  const selectedSuite = flags.suite.toLowerCase()
  const VALID_SUITES = ['all', 'dom-reactivity', 'dom', 'bundle-hydration', 'bundle', 'hydration', 'ssr-throughput', 'ssr', 'internal', 'stress', 'lifecycle']

  if (!VALID_SUITES.includes(selectedSuite)) {
    console.error(`\n❌ Error: Unknown suite "${flags.suite}".`)
    console.error(`   Allowed suites: ${VALID_SUITES.join(', ')}\n`)
    process.exit(1)
  }

  if (selectedSuite === 'all' || selectedSuite === 'dom-reactivity' || selectedSuite === 'dom') {
    const domResults = await runDomReactivitySuite({
      iterations: flags.iterations,
      rows: flags.rows
    })
    resultsData.suites['dom-reactivity'] = domResults
    triggerGC()
  }

  if (selectedSuite === 'all' || selectedSuite === 'bundle-hydration' || selectedSuite === 'bundle' || selectedSuite === 'hydration') {
    const bundleResults = await runBundleHydrationSuite({
      iterations: flags.iterations
    })
    resultsData.suites['bundle-hydration'] = bundleResults
    triggerGC()
  }

  if (selectedSuite === 'all' || selectedSuite === 'ssr-throughput' || selectedSuite === 'ssr') {
    const ssrResults = await runSSRThroughputSuite()
    resultsData.suites.ssrThroughput = ssrResults
    triggerGC()
  }

  if (selectedSuite === 'all' || selectedSuite === 'internal') {
    const internalResults = await runInternalSuite()
    resultsData.suites.internal = internalResults
    triggerGC()
  }

  if (selectedSuite === 'all' || selectedSuite === 'stress' || selectedSuite === 'lifecycle') {
    const stressResults = await runStressLifecycleSuite({
      iterations: flags.iterations
    })
    resultsData.suites['stress-lifecycle'] = stressResults
    triggerGC()
  }

  printTerminalResults(resultsData)
  writeMarkdownResults(resultsData)

  const taskResult = formatTaskResults(resultsData, flags.taskId, flags.phase)

  if (flags.save) {
    const resultsDir = path.resolve(__dirname, '../../../benchmarks/results')
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true })
    }
    const targetFile = path.join(resultsDir, `${flags.taskId}.json`)
    fs.writeFileSync(targetFile, JSON.stringify(taskResult, null, 2), 'utf-8')
    console.log(`\n✅ Benchmark results successfully saved to ${targetFile}`)
  } else {
    console.log('\n--- Task Result JSON (stdout) ---')
    console.log(JSON.stringify(taskResult, null, 2))
  }

  if (flags.saveBaseline) {
    writeJSONResults(resultsData, DEFAULT_BASELINE_PATH)
    console.log(`Baseline successfully saved to ${DEFAULT_BASELINE_PATH}`)
  } else if (flags.json || selectedSuite === 'all') {
    writeJSONResults(resultsData)
    console.log('Results successfully written to packages/coralite/benchmarks/results/latest.json')
  }

  if (flags.checkRegression) {
    console.log('\n--- Checking Performance Regressions against Baseline ---')
    const checkResult = compareAgainstBaseline(resultsData)
    if (checkResult.error) {
      console.log(`ℹ️ Note: No baseline found at ${DEFAULT_BASELINE_PATH}.\n   Skipping regression checks. Run 'pnpm run bench:save-baseline' to save a baseline snapshot.`)
      process.exit(0)
    } else if (checkResult.regressions.length === 0) {
      console.log('✅ Zero performance regressions detected.')
    } else {
      console.log('\n⚠️ Performance Comparisons:')
      console.table(checkResult.regressions.map(r => ({
        Suite: r.suite,
        Item: r.item,
        Metric: r.metric,
        Baseline: r.baseline,
        Current: r.current,
        'Diff %': `${r.diffPercent}%`,
        Status: r.isError ? '❌ FAIL' : '⚠️ WARN'
      })))

      if (!checkResult.passed) {
        if (flags.warnOnly) {
          console.log('\n⚠️ Performance regressions detected but --warn-only flag is set. Exiting cleanly with code 0.')
        } else {
          console.error('\n❌ Performance regression check failed!')
          process.exit(1)
        }
      }
    }
  }
}

main().catch((err) => {
  console.error('Benchmark execution error:', err)
  process.exit(1)
})
