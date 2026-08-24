import process from 'node:process'
import { printTerminalResults, writeJSONResults, writeMarkdownResults } from './utils/reporter.js'
import { triggerGC } from './utils/memory.js'
import { runDomReactivitySuite } from './suites/01-dom-reactivity/bench.js'
import { runBundleHydrationSuite } from './suites/02-bundle-hydration/bench.js'
import { runSSRThroughputSuite } from './suites/03-ssr-throughput/bench.js'
import { runInternalSuite } from './suites/04-internal/bench.js'

function parseArgs () {
  const args = process.argv.slice(2)
  const flags = {
    help: false,
    suite: 'all',
    json: false,
    iterations: 5,
    rows: 1000
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--help' || arg === '-h') {
      flags.help = true
    } else if (arg.startsWith('--suite=')) {
      flags.suite = arg.split('=')[1]
    } else if (arg === '-s' && i + 1 < args.length) {
      flags.suite = args[++i]
    } else if (arg === '--json') {
      flags.json = true
    } else if (arg.startsWith('--iterations=')) {
      flags.iterations = parseInt(arg.split('=')[1], 10) || 5
    } else if (arg === '-i' && i + 1 < args.length) {
      flags.iterations = parseInt(args[++i], 10) || 5
    } else if (arg.startsWith('--rows=')) {
      flags.rows = parseInt(arg.split('=')[1], 10) || 1000
    } else if (arg === '-r' && i + 1 < args.length) {
      flags.rows = parseInt(args[++i], 10) || 1000
    }
  }

  return flags
}

function printHelp () {
  console.log(`
Coralite Benchmark Runner CLI

Usage:
  node --expose-gc --experimental-vm-modules ./benchmarks/runner.js [options]

Options:
  --help, -h          Display formatted CLI usage and exit
  --suite=<name>, -s  Run a specific benchmark suite (dom-reactivity, bundle-hydration, ssr-throughput, internal, or all [default: all])
  --json              Write benchmark results to packages/coralite/benchmarks/results/latest.json
  --iterations=<n>, -i Set iteration count per test (default: 5)
  --rows=<n>, -r      Set row count for DOM reactivity suite (default: 1000)
`)
}

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
  const VALID_SUITES = ['all', 'dom-reactivity', 'dom', 'bundle-hydration', 'bundle', 'hydration', 'ssr-throughput', 'ssr', 'internal']

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

  printTerminalResults(resultsData)
  writeMarkdownResults(resultsData)

  // Write JSON report automatically on master/all run or when --json flag is passed
  if (flags.json || selectedSuite === 'all') {
    writeJSONResults(resultsData)
    console.log('Results successfully written to packages/coralite/benchmarks/results/latest.json')
  }
}

main().catch((err) => {
  console.error('Benchmark execution error:', err)
  process.exit(1)
})
