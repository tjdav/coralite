import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const DEFAULT_BASELINE_PATH = path.resolve(__dirname, '../baselines/baseline.json')

/**
 * Compares current benchmark results against baseline results.
 * Thresholds:
 * - DOM Reactivity & Microbench Latency: Warning at >10%, Failure at >15%
 * - Client Bundle Size (gzipped): Failure at >5%
 *
 * @param {Object} currentData - Current benchmark run data object
 * @param {string} [baselinePath] - Path to baseline.json file
 * @returns {Object} `{ passed: boolean, hasWarnings: boolean, regressions: Array<{ suite, metric, baseline, current, diffPercent, isError }> }`
 */
export function compareAgainstBaseline (currentData, baselinePath = DEFAULT_BASELINE_PATH) {
  if (!fs.existsSync(baselinePath)) {
    return {
      passed: true,
      hasWarnings: false,
      regressions: [],
      error: `Baseline file does not exist at: ${baselinePath}`
    }
  }

  const baselineRaw = fs.readFileSync(baselinePath, 'utf-8')
  const baselineData = JSON.parse(baselineRaw)

  const regressions = []
  let passed = true
  let hasWarnings = false

  const currentSuites = currentData.suites || {}
  const baselineSuites = baselineData.suites || {}

  function checkMetric (suite, fwOrWorkload, metricKey, currentVal, baselineVal) {
    if (typeof currentVal !== 'number' || typeof baselineVal !== 'number' || baselineVal === 0) {
      return
    }

    const diffPercent = +(((currentVal - baselineVal) / baselineVal) * 100).toFixed(2)

    // Bundle size check (gzipped JS)
    if (metricKey === 'gzipKB') {
      if (diffPercent > 5) {
        passed = false
        regressions.push({
          suite,
          item: fwOrWorkload,
          metric: metricKey,
          baseline: baselineVal,
          current: currentVal,
          diffPercent,
          isError: true,
          message: `Gzip bundle size grew by ${diffPercent}% (limit 5%)`
        })
      }
      return
    }

    // Latency checks (latency, ops, duration)
    // For timing/latency (higher is worse):
    const isLatencyMetric = [
      'create1k', 'replace1k', 'create10k', 'replace10k',
      'update10th', 'swapRows', 'clear', 'hydrationMS', 'ttiMS',
      'avgLatencyMS', 'avgLatencyNs', 'avgBatchLatencyMS', 'peakCpuTimeMS'
    ].includes(metricKey)

    if (isLatencyMetric) {
      if (diffPercent > 15) {
        passed = false
        regressions.push({
          suite,
          item: fwOrWorkload,
          metric: metricKey,
          baseline: baselineVal,
          current: currentVal,
          diffPercent,
          isError: true,
          message: `Latency increased by ${diffPercent}% (limit 15%)`
        })
      } else if (diffPercent > 10) {
        hasWarnings = true
        regressions.push({
          suite,
          item: fwOrWorkload,
          metric: metricKey,
          baseline: baselineVal,
          current: currentVal,
          diffPercent,
          isError: false,
          message: `Latency increased by ${diffPercent}% (warning > 10%)`
        })
      }
    }
  }

  function walkAndCompare (suiteName, currentObj, baselineObj) {
    if (!currentObj || !baselineObj) {
      return
    }

    if (Array.isArray(currentObj) && Array.isArray(baselineObj)) {
      for (let i = 0; i < currentObj.length; i++) {
        const curItem = currentObj[i]
        const baseItem = baselineObj[i] || {}
        const name = curItem.benchmark || curItem.Workload || `Item ${i}`
        for (const [k, v] of Object.entries(curItem)) {
          if (k in baseItem) {
            checkMetric(suiteName, name, k, v, baseItem[k])
          }
        }
      }
      return
    }

    for (const [key, val] of Object.entries(currentObj)) {
      if (!(key in baselineObj)) {
        continue
      }
      const baseVal = baselineObj[key]

      if (typeof val === 'number' && typeof baseVal === 'number') {
        checkMetric(suiteName, suiteName, key, val, baseVal)
      } else if (typeof val === 'object' && val !== null && typeof baseVal === 'object' && baseVal !== null) {
        for (const [mKey, mVal] of Object.entries(val)) {
          if (mKey in baseVal) {
            checkMetric(suiteName, key, mKey, mVal, baseVal[mKey])
          }
        }
      }
    }
  }

  for (const [suiteName, currentObj] of Object.entries(currentSuites)) {
    if (suiteName in baselineSuites) {
      walkAndCompare(suiteName, currentObj, baselineSuites[suiteName])
    }
  }

  return {
    passed,
    hasWarnings,
    regressions
  }
}
