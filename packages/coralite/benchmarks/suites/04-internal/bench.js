import { run } from 'mitata'
import { setupTokenInterpolationBench } from './token-interpolation.js'
import { setupLazyProxyBench } from './lazy-proxy.js'
import { setupASTDOMCreationBench } from './ast-dom-creation.js'

/**
 * Runs internal engine micro-benchmarks using mitata and formats output stats.
 *
 * @param {Object} [options]
 * @returns {Promise<Array<{ benchmark: string, opsPerSec: number, avgLatencyNs: number, speedup: number }>>}
 */
export async function runInternalSuite (options = {}) {
  console.log('Running internal engine micro-benchmarks (mitata)...')

  setupTokenInterpolationBench()
  setupLazyProxyBench()
  setupASTDOMCreationBench()

  const mitataResult = await run()

  const results = []
  if (mitataResult && Array.isArray(mitataResult.benchmarks)) {
    let groupBaselineAvgMs = null

    for (const b of mitataResult.benchmarks) {
      const name = b.alias || b.name || (b.runs && b.runs[0] && b.runs[0].name) || 'unnamed'
      const stats = b.runs && b.runs[0] && b.runs[0].stats
      if (!stats) {
        continue
      }

      const avgNs = stats.avg || (stats.iter && stats.iter.avg) || 0
      const avgLatencyNs = +avgNs.toFixed(1)
      const opsPerSec = avgNs > 0 ? +(1e9 / avgNs).toFixed(0) : 0

      if (groupBaselineAvgMs === null) {
        groupBaselineAvgMs = avgNs
      }

      const speedup = (groupBaselineAvgMs && avgNs > 0)
        ? +(groupBaselineAvgMs / avgNs).toFixed(2)
        : 1.0

      results.push({
        benchmark: name,
        opsPerSec,
        avgLatencyNs,
        speedup
      })
    }
  }

  return results
}
