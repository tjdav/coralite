import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_RESULTS_PATH = path.resolve(__dirname, '../results/latest.json')
const DEFAULT_BENCHMARKS_MD_PATH = path.resolve(__dirname, '../BENCHMARKS.md')

const HEADER_LABELS = {
  rawKB: 'Raw JS (KB)',
  gzipKB: 'Gzip JS (KB)',
  hydrationMS: 'Hydration (ms)',
  ttiMS: 'TTI (ms)',
  totalPages: 'Total Pages',
  totalDurationMS: 'Duration (ms)',
  pagesPerSec: 'Throughput (pages/sec)',
  avgLatencyMS: 'Avg Latency (ms)',
  heapUsedMB: 'Peak Heap (MB)',
  benchmark: 'Benchmark',
  opsPerSec: 'Ops/Sec',
  avgLatencyNs: 'Avg Latency (ns)',
  speedup: 'Speedup',
  totalUpdates: 'Total Updates',
  avgBatchLatencyMS: 'Avg Batch Latency (ms)',
  droppedFrames: 'Dropped Frames',
  peakCpuTimeMS: 'Peak CPU Time (ms)',
  cycles: 'Cycles',
  componentsPerCycle: 'Components / Cycle',
  initialHeapMB: 'Initial Heap (MB)',
  finalHeapMB: 'Final Heap (MB)',
  netRetentionMB: 'Net Retention (MB)',
  status: 'Status'
}

/**
 * Writes benchmark results to a JSON file.
 *
 * @param {Object} data - Benchmark results data
 * @param {string} [outputPath] - Destination path
 */
export function writeJSONResults (data, outputPath = DEFAULT_RESULTS_PATH) {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Generates a formatted Markdown table for a suite's results.
 *
 * @param {string} suiteName - Name of the suite
 * @param {Object|Array} suiteResults - Suite result object or array
 * @returns {string} Markdown table string
 */
export function generateMarkdownTable (suiteName, suiteResults) {
  if (!suiteResults || (typeof suiteResults === 'object' && Object.keys(suiteResults).length === 0)) {
    return ''
  }

  if (suiteName === 'stress-lifecycle' || suiteName === 'stress') {
    let md = ''

    if (suiteResults.islandScaling) {
      md += generateMarkdownTable('Stress & Lifecycle: Selective Hydration & Island Scaling', suiteResults.islandScaling) + '\n\n'
    }

    if (suiteResults.streaming) {
      const streamingRow = [{
        totalUpdates: suiteResults.streaming.totalUpdates,
        avgBatchLatencyMS: suiteResults.streaming.avgBatchLatencyMS,
        droppedFrames: suiteResults.streaming.droppedFrames,
        peakCpuTimeMS: suiteResults.streaming.peakCpuTimeMS
      }]
      md += generateMarkdownTable('Stress & Lifecycle: High-Frequency State Streaming (100 updates/sec)', streamingRow) + '\n\n'
    }

    if (suiteResults.lifecycle) {
      const isPassed = suiteResults.lifecycle.passed !== undefined
        ? suiteResults.lifecycle.passed
        : suiteResults.lifecycle.netRetentionMB < 0.5
      const statusText = isPassed ? '✅ Passed (<0.5 MB)' : '❌ Failed (>=0.5 MB)'

      const lifecycleRow = [{
        cycles: suiteResults.lifecycle.cycles,
        componentsPerCycle: suiteResults.lifecycle.componentsPerCycle,
        initialHeapMB: suiteResults.lifecycle.initialHeapMB,
        finalHeapMB: suiteResults.lifecycle.finalHeapMB,
        netRetentionMB: suiteResults.lifecycle.netRetentionMB,
        status: statusText
      }]
      md += generateMarkdownTable('Stress & Lifecycle: Mount/Unmount Memory Retention', lifecycleRow)
    }

    return md.trim()
  }

  let md = `### ${suiteName}\n\n`

  if (Array.isArray(suiteResults)) {
    if (suiteResults.length === 0) {
      return ''
    }
    const sample = suiteResults[0]
    const keys = Object.keys(sample)
    const headers = keys.map(k => HEADER_LABELS[k] || k)

    md += `| ${headers.join(' | ')} |\n`
    md += `| ${'--- | '.repeat(keys.length).slice(0, -1)}\n`

    for (const item of suiteResults) {
      const row = keys.map(k => item[k])
      md += `| ${row.join(' | ')} |\n`
    }
    return md
  }

  const keysOrFrameworks = Object.keys(suiteResults)
  const firstVal = suiteResults[keysOrFrameworks[0]]

  if (typeof firstVal !== 'object' || firstVal === null) {
    return ''
  }

  const metrics = Object.keys(firstVal)
  const displayHeaders = metrics.map(m => HEADER_LABELS[m] || m)

  const firstColHeader = suiteName === 'ssrThroughput' || suiteName === 'ssr-throughput' ? 'Workload' : 'Framework'

  md += `| ${firstColHeader} | ${displayHeaders.join(' | ')} |\n`
  md += `| ${'--- | '.repeat(metrics.length + 1).slice(0, -1)}\n`

  for (const key of keysOrFrameworks) {
    const row = metrics.map(m => suiteResults[key][m])
    md += `| ${key} | ${row.join(' | ')} |\n`
  }
  return md
}

/**
 * Writes markdown formatted results to BENCHMARKS.md.
 *
 * @param {Object} data - Benchmark results object
 * @param {string} [outputPath] - Destination file path
 */
export function writeMarkdownResults (data, outputPath = DEFAULT_BENCHMARKS_MD_PATH) {
  let content = '# Coralite Performance Benchmarks\n\n'
  content += `Last updated: ${data.timestamp}\n\n`
  content += `**Environment:** Node ${data.environment.node} (${data.environment.platform} ${data.environment.arch})\n\n`

  for (const [suiteName, suiteResults] of Object.entries(data.suites || {})) {
    content += generateMarkdownTable(suiteName, suiteResults) + '\n\n'
  }

  content += `## Reproduction Instructions

To reproduce these benchmarks on your machine:

\`\`\`bash
# 1. Install dependencies
pnpm install

# 2. Run all benchmark suites
pnpm bench
\`\`\`
`

  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(outputPath, content, 'utf-8')
}

/**
 * Prints benchmark results to the console table.
 *
 * @param {Object} data - Benchmark results object
 */
export function printTerminalResults (data) {
  console.log('\n=== Benchmark Results ===\n')
  if (!data || !data.suites) {
    console.log('No suite results available.')
    return
  }
  for (const [suiteName, suiteResults] of Object.entries(data.suites)) {
    if (suiteName === 'stress-lifecycle' || suiteName === 'stress') {
      if (suiteResults.islandScaling) {
        console.log(`Suite: ${suiteName} (Selective Hydration & Island Scaling)`)
        const formattedIsland = {}
        for (const [fw, metricsObj] of Object.entries(suiteResults.islandScaling)) {
          const formattedMetrics = {}
          for (const [mKey, val] of Object.entries(metricsObj)) {
            formattedMetrics[HEADER_LABELS[mKey] || mKey] = val
          }
          formattedIsland[fw] = formattedMetrics
        }
        console.table(formattedIsland)
        console.log('')
      }

      if (suiteResults.streaming) {
        console.log(`Suite: ${suiteName} (High-Frequency State Streaming)`)
        const formattedStreaming = [{
          [HEADER_LABELS.totalUpdates]: suiteResults.streaming.totalUpdates,
          [HEADER_LABELS.avgBatchLatencyMS]: suiteResults.streaming.avgBatchLatencyMS,
          [HEADER_LABELS.droppedFrames]: suiteResults.streaming.droppedFrames,
          [HEADER_LABELS.peakCpuTimeMS]: suiteResults.streaming.peakCpuTimeMS
        }]
        console.table(formattedStreaming)
        console.log('')
      }

      if (suiteResults.lifecycle) {
        console.log(`Suite: ${suiteName} (Mount/Unmount Memory Retention)`)
        const isPassed = suiteResults.lifecycle.passed !== undefined
          ? suiteResults.lifecycle.passed
          : suiteResults.lifecycle.netRetentionMB < 0.5
        const statusText = isPassed ? '✅ Passed (<0.5 MB)' : '❌ Failed (>=0.5 MB)'

        const formattedLifecycle = [{
          [HEADER_LABELS.cycles]: suiteResults.lifecycle.cycles,
          [HEADER_LABELS.componentsPerCycle]: suiteResults.lifecycle.componentsPerCycle,
          [HEADER_LABELS.initialHeapMB]: suiteResults.lifecycle.initialHeapMB,
          [HEADER_LABELS.finalHeapMB]: suiteResults.lifecycle.finalHeapMB,
          [HEADER_LABELS.netRetentionMB]: suiteResults.lifecycle.netRetentionMB,
          [HEADER_LABELS.status]: statusText
        }]
        console.table(formattedLifecycle)
        console.log('')
      }
      continue
    }

    console.log(`Suite: ${suiteName}`)

    if (Array.isArray(suiteResults)) {
      const formattedList = suiteResults.map(item => {
        const formatted = {}
        for (const [k, v] of Object.entries(item)) {
          formatted[HEADER_LABELS[k] || k] = v
        }
        return formatted
      })
      console.table(formattedList)
      console.log('')
      continue
    }

    const formattedTable = {}
    for (const [fw, metricsObj] of Object.entries(suiteResults)) {
      const formattedMetrics = {}
      for (const [metricKey, val] of Object.entries(metricsObj)) {
        const label = HEADER_LABELS[metricKey] || metricKey
        formattedMetrics[label] = val
      }
      formattedTable[fw] = formattedMetrics
    }

    console.table(formattedTable)
    console.log('')
  }
}
