import process from 'node:process'
import { runInternalSuite } from './suites/04-internal/bench.js'
import { runDomReactivitySuite } from './suites/01-dom-reactivity/bench.js'
import { printTerminalResults } from './utils/reporter.js'
import { compareAgainstBaseline, DEFAULT_BASELINE_PATH } from './utils/regression.js'
import { triggerGC } from './utils/memory.js'

async function runCI () {
  console.log('🚀 Executing Fast CI Regression Suite...')
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

  // 1. Run internal microbenchmarks
  console.log('Running internal microbenchmarks...')
  resultsData.suites.internal = await runInternalSuite()
  triggerGC()

  // 2. Run DOM reactivity smoke test (9 iterations)
  console.log('Running DOM reactivity smoke test...')
  resultsData.suites['dom-reactivity'] = await runDomReactivitySuite({
    iterations: 9,
    rows: 1000
  })

  printTerminalResults(resultsData)

  const checkResult = compareAgainstBaseline(resultsData)
  if (checkResult.error) {
    console.log(`ℹ️ Note: No baseline found at ${DEFAULT_BASELINE_PATH}.\n   Skipping regression checks. Run 'pnpm run bench:save-baseline' to save a baseline snapshot.`)
    process.exit(0)
  }

  if (checkResult.regressions.length > 0) {
    console.table(checkResult.regressions.map(r => ({
      Suite: r.suite,
      Item: r.item,
      Metric: r.metric,
      Baseline: r.baseline,
      Current: r.current,
      'Diff %': `${r.diffPercent}%`,
      Status: r.isError ? '❌ FAIL' : '⚠️ WARN'
    })))
  }

  if (!checkResult.passed) {
    const isWarnOnly = process.argv.includes('--warn-only')
    if (isWarnOnly) {
      console.log('⚠️ CI Regressions detected but --warn-only flag present. Exiting cleanly with code 0.')
      process.exit(0)
    }
    console.error('❌ Fast CI Performance Regression Check Failed!')
    process.exit(1)
  }

  console.log('✅ Fast CI Performance Regression Check Passed!')
}

runCI().catch(err => {
  console.error('CI Runner error:', err)
  process.exit(1)
})
