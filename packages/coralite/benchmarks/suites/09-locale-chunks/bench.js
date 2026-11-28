import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createCoralite } from '../../../lib/index.js'
import { definePlugin } from '../../../lib/server/plugin/define.js'

const pageSource = `<!DOCTYPE html>
<html lang="en"><head><title>{{ title }}</title></head><body><h1>{{ title }}</h1></body></html>
<script type="module">
  export function paths () { return [{ lang: 'en' }, { lang: 'fr' }] }
  export function server ({ route }) { return { title: route.params.lang } }
</script>`

/**
 * Measures a warm build and a one-locale dictionary edit for one strategy.
 *
 * @param {Object} options - Measurement options.
 * @param {string} options.root - Temporary root directory.
 * @param {string} options.strategy - plain or locales.
 * @returns {Promise<Object>} Metrics for the strategy.
 */
async function measureStrategy ({ root, strategy }) {
  const scenarioRoot = path.join(root, strategy)
  const pagesDir = path.join(scenarioRoot, 'pages')
  const componentsDir = path.join(scenarioRoot, 'components')
  await fs.mkdir(path.join(pagesDir, '[lang]'), { recursive: true })
  await fs.mkdir(componentsDir, { recursive: true })
  await fs.writeFile(path.join(pagesDir, '[lang]', 'index.html'), pageSource)

  const locales = {
    en: { welcome: 'Welcome' },
    fr: { welcome: 'Bienvenue' }
  }
  const plugin = definePlugin({
    name: 'i18n-bench',
    client: {
      config: { locales },
      init: () => {}
    }
  })

  const app = await createCoralite({
    components: componentsDir,
    pages: pagesDir,
    projectRoot: scenarioRoot,
    output: undefined,
    plugins: [plugin],
    i18n: strategy === 'locales' ? { locales: ['en', 'fr'], defaultLocale: 'en' } : undefined
  })

  try {
    await app.build()
    let started = performance.now()
    const warm = await app.build()
    const warmMs = performance.now() - started
    const runtimeBefore = Object.keys(app.outputFiles).find(name => name.includes('coralite-runtime'))
    const enBefore = Object.keys(app.outputFiles).find(name => name.includes('/locale-en-')) || null

    locales.fr.welcome = 'Bienvenue !'
    started = performance.now()
    const changed = await app.build()
    const editMs = performance.now() - started
    const runtimeAfter = Object.keys(app.outputFiles).find(name => name.includes('coralite-runtime'))
    const enAfter = Object.keys(app.outputFiles).find(name => name.includes('/locale-en-')) || null

    return {
      warmMs: +warmMs.toFixed(1),
      editMs: +editMs.toFixed(1),
      renderedOnEdit: changed.filter(result => result.status !== 'skipped').length,
      skippedOnEdit: changed.filter(result => result.status === 'skipped').length,
      runtimeChunkStable: runtimeBefore === runtimeAfter,
      enChunkStable: enBefore !== null && enBefore === enAfter
    }
  } finally {
    await app.clearCache(true)
  }
}

/**
 * Benchmarks locale config chunk isolation against the shared runtime.
 *
 * @param {Object} options - Suite options.
 * @param {string} [options.mode] - Strategy to run: plain, locales or all.
 * @returns {Promise<Object>} Strategy metrics.
 */
export async function runLocaleChunksSuite ({ mode = 'all' } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'coralite-locale-bench-'))
  const strategies = mode === 'all' ? ['plain', 'locales'] : [mode]

  try {
    const results = {}
    for (const strategy of strategies) {
      results[strategy] = await measureStrategy({ root, strategy })
    }
    return results
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}
