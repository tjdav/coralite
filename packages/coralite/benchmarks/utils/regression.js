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
 * - Client Bundle Size (gzipKB, rawKB): Failure at >5%
 * - Memory Retention (stress-lifecycle): Failure at >= 0.5 MB
 *
 * @param {Object} currentData - Current benchmark run data object
 * @param {string} [baselinePath] - Path to baseline.json file
 * @returns {Object} `{ passed: boolean, hasWarnings: boolean, regressions: Array<{ suite, item, metric, baseline, current, diffPercent, isError, message }> }`
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
  let baselineData = {}
  try {
    baselineData = JSON.parse(baselineRaw)
  } catch (e) {
    return {
      passed: true,
      hasWarnings: false,
      regressions: [],
      error: `Failed to parse baseline file at ${baselinePath}: ${e.message}`
    }
  }

  const regressions = []
  let passed = true
  let hasWarnings = false

  const currentSuites = currentData.suites || {}
  const baselineSuites = baselineData.suites || {}

  // Check net memory retention for stress-lifecycle
  const stressLifecycle = currentSuites['stress-lifecycle'] || currentSuites.stress
  if (stressLifecycle && stressLifecycle.lifecycle) {
    const netRet = stressLifecycle.lifecycle.netRetentionMB
    if (typeof netRet === 'number' && netRet >= 0.5) {
      passed = false
      regressions.push({
        suite: 'stress-lifecycle',
        item: 'lifecycle',
        metric: 'netRetentionMB',
        baseline: 0.5,
        current: netRet,
        diffPercent: 0,
        isError: true,
        message: `netRetentionMB exceeded limit: current ${netRet} MB >= limit 0.5 MB`
      })
    }
  }

  function checkMetric (suite, fwOrWorkload, metricKey, currentVal, baselineVal) {
    if (typeof currentVal !== 'number' || typeof baselineVal !== 'number' || baselineVal === 0) {
      return
    }

    const diffPercent = +(((currentVal - baselineVal) / baselineVal) * 100).toFixed(2)

    // Bundle size check (gzipKB, rawKB)
    if (metricKey === 'gzipKB' || metricKey === 'rawKB') {
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
          message: `${metricKey} regressed by +${diffPercent}% (baseline: ${baselineVal}, current: ${currentVal})`
        })
      }
      return
    }

    // Latency checks (latency, ops, duration)
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
          message: `${metricKey} regressed by +${diffPercent}% (baseline: ${baselineVal}, current: ${currentVal})`
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
          message: `${metricKey} increased by +${diffPercent}% (warning > 10%, baseline: ${baselineVal}, current: ${currentVal})`
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
            if (typeof mVal === 'number' && typeof baseVal[mKey] === 'number') {
              checkMetric(suiteName, key, mKey, mVal, baseVal[mKey])
            } else if (typeof mVal === 'object' && mVal !== null && typeof baseVal[mKey] === 'object' && baseVal[mKey] !== null) {
              for (const [subKey, subVal] of Object.entries(mVal)) {
                if (subKey in baseVal[mKey]) {
                  checkMetric(suiteName, `${key}.${mKey}`, subKey, subVal, baseVal[mKey][subKey])
                }
              }
            }
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
