import { performance } from 'node:perf_hooks'
import { validateComponentsDir } from '../lib/component-validator.js'
import { validatePagesDir } from '../lib/page-validator.js'
import { validatePluginsDir } from '../lib/plugin-validator.js'

/**
 * Benchmark runner for asynchronous directory validation.
 */
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runValidatorBenchmark (iterations = 50) {
  const compDir = join(__dirname, '../tests/fixtures/components')
  const pageDir = join(__dirname, '../tests/fixtures/pages')
  const pluginDir = join(__dirname, '../tests/fixtures/plugins')

  // Warmup run
  await validateComponentsDir(compDir)
  await validatePagesDir(pageDir)
  await validatePluginsDir(pluginDir)

  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await validateComponentsDir(compDir)
    await validatePagesDir(pageDir)
    await validatePluginsDir(pluginDir)
  }
  const totalDurationMS = performance.now() - start
  const avgDurationMS = totalDurationMS / iterations

  console.log(`[Validator Benchmark] Completed ${iterations} iterations in ${totalDurationMS.toFixed(2)} ms (avg ${avgDurationMS.toFixed(2)} ms/iter)`)
  return {
    iterations,
    totalDurationMS,
    avgDurationMS
  }
}

if (process.argv[1] && process.argv[1].endsWith('validator-benchmark.js')) {
  runValidatorBenchmark().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
