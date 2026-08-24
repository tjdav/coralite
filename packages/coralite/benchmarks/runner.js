import process from 'node:process'
import { printTerminalResults, writeJSONResults } from './utils/reporter.js'
import { getMemoryUsage, triggerGC } from './utils/memory.js'

function parseArgs () {
  const args = process.argv.slice(2)
  const flags = {
    help: false,
    suite: 'all',
    json: false,
    iterations: 5
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

  if (selectedSuite === 'all' || selectedSuite === 'internal') {
    resultsData.suites.internal = {
      coralite: {
        initialMemoryMB: getMemoryUsage().heapUsedMB
      }
    }
  }

  printTerminalResults(resultsData)

  if (flags.json) {
    writeJSONResults(resultsData)
    console.log('Results successfully written to packages/coralite/benchmarks/results/latest.json')
  }
}

main().catch((err) => {
  console.error('Benchmark execution error:', err)
  process.exit(1)
})
