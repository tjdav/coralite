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

  const groupBaselines = new Set([
    'Coralite Token Replace (textNode)',
    'Coralite Read-Only Proxy (Deep Read)',
    'Optimized Object.setPrototypeOf AST Element Creation'
  ])

  const results = []
  if (mitataResult && Array.isArray(mitataResult.benchmarks)) {
    let groupBaselineAvgNs = null

    for (const b of mitataResult.benchmarks) {
      const name = b.alias || b.name || (b.runs && b.runs[0] && b.runs[0].name) || 'unnamed'
      const stats = b.runs && b.runs[0] && b.runs[0].stats
      if (!stats) {
        continue
      }

      const avgNs = stats.avg || (stats.iter && stats.iter.avg) || 0
      const avgLatencyNs = +avgNs.toFixed(1)
      const opsPerSec = avgNs > 0 ? +(1e9 / avgNs).toFixed(0) : 0

      if (groupBaselines.has(name) || groupBaselineAvgNs === null) {
        groupBaselineAvgNs = avgNs
      }

      const speedup = (groupBaselineAvgNs && avgNs > 0)
        ? +(groupBaselineAvgNs / avgNs).toFixed(2)
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
