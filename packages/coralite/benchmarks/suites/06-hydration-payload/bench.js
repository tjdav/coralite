import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import { createCoralite } from '../../../lib/index.js'

const INSTANCE_COUNT = 63

function gzipKB (value) {
  return +((zlib.gzipSync(Buffer.from(value)).length / 1024)).toFixed(1)
}

function rawKB (value) {
  return +((Buffer.byteLength(value) / 1024)).toFixed(1)
}

function extractHydrationPayload (html) {
  const match = html.match(/coralite\.state\.hydration\s*=\s*Object\.assign\(\s*\{\},\s*coralite\.state\.hydration\s*\|\|\s*\{\},\s*(\{[\s\S]*?\})\s*\);/)
  if (!match || match[1] === '{}') {
    return ''
  }
  return match[1]
}

function countInstances (payload) {
  if (!payload) {
    return 0
  }
  try {
    return Object.keys(JSON.parse(payload)).length
  } catch {
    return 0
  }
}

function measureJsAssets (outputFiles) {
  const scripts = Object.values(outputFiles || {})
    .filter(file => {
      const filePath = file.path || file.hashedPath || ''
      return filePath.endsWith('.js') && !filePath.endsWith('.js.map')
    })
    .map(file => file.contents !== undefined ? file.contents : file.text || '')
    .join('\n')

  return {
    jsRawKB: rawKB(scripts),
    jsGzipKB: gzipKB(scripts)
  }
}

async function measureScenario ({ root, name, pageHtml, components }) {
  const scenarioRoot = path.join(root, name)
  const pagesDir = path.join(scenarioRoot, 'pages')
  const componentsDir = path.join(scenarioRoot, 'components')
  const outputDir = path.join(scenarioRoot, 'dist')

  await fs.mkdir(pagesDir, { recursive: true })
  await fs.mkdir(componentsDir, { recursive: true })

  for (const [filename, contents] of Object.entries(components)) {
    await fs.writeFile(path.join(componentsDir, filename), contents)
  }
  await fs.writeFile(path.join(pagesDir, 'index.html'), pageHtml)

  const app = await createCoralite({
    components: componentsDir,
    pages: pagesDir,
    output: outputDir,
    projectRoot: scenarioRoot,
    cacheDir: path.join(scenarioRoot, '.coralite'),
    mode: 'production',
    incremental: false
  })

  try {
    const results = await app.build()
    const html = results[0]?.content || ''
    const hydrationPayload = extractHydrationPayload(html)
    const jsMetrics = measureJsAssets(app.outputFiles)
    const instanceCount = countInstances(hydrationPayload)

    return {
      htmlRawKB: rawKB(html),
      htmlGzipKB: gzipKB(html),
      hydrationRawKB: rawKB(hydrationPayload),
      hydrationGzipKB: gzipKB(hydrationPayload),
      ...jsMetrics,
      instances: instanceCount,
      bytesPerInstance: hydrationPayload
        ? +(Buffer.byteLength(hydrationPayload) / Math.max(1, instanceCount)).toFixed(0)
        : 0
    }
  } finally {
    await app.clearCache(true)
  }
}

function buildPage (tag, count, labelPrefix) {
  const instances = Array.from({ length: count }, (_, index) => {
    return `<${tag} label="${labelPrefix}-${index}"></${tag}>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head><title>{{ title }}</title></head>
<body>
${instances}
</body>
</html>

<script type="module">
  export function server () {
    const related = Array.from({ length: 20 }, (_, index) => ({
      id: index,
      title: 'Related item ' + index,
      summary: 'Hydration benchmark related content for item ' + index
    }))

    return {
      title: 'Hydration payload benchmark',
      event: {
        id: 'event-1',
        title: 'Event detail',
        description: 'Large page state used to measure hydration duplication',
        metadata: {
          venue: 'Benchmark hall',
          location: 'Local',
          tags: ['perf', 'hydration', 'payload']
        }
      },
      related,
      big: { a: 1, b: 2, c: 3, d: 4 }
    }
  }
</script>
`
}

/**
 * Measures client-side HTML, hydration payload, and generated JS sizes.
 *
 * @returns {Promise<Object>} Benchmark results keyed by scenario.
 */
export async function runHydrationPayloadSuite () {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'coralite-hydration-bench-'))

  try {
    const dynamicComponent = `<template id="bench-widget">
  <button ref="button">{{ display }}</button>
</template>

<script type="module">
  export const attributes = {
    label: { type: String, default: '' }
  }

  export const getters = {
    display: ({ state }) => state.label || 'none'
  }

  export function client ({ refs }) {
    refs('button').addEventListener('click', () => {})
  }
</script>
`

    const staticComponent = `<template id="bench-badge">
  <span class="badge">{{ label }}</span>
</template>

<script type="module">
  export const attributes = {
    label: { type: String, default: '' }
  }
</script>
`

    const dynamic = await measureScenario({
      root,
      name: 'dynamic',
      pageHtml: buildPage('bench-widget', INSTANCE_COUNT, 'dynamic'),
      components: {
        'bench-widget.html': dynamicComponent
      }
    })

    const staticScenario = await measureScenario({
      root,
      name: 'static',
      pageHtml: buildPage('bench-badge', INSTANCE_COUNT, 'static'),
      components: {
        'bench-badge.html': staticComponent
      }
    })

    return {
      dynamic,
      static: staticScenario
    }
  } finally {
    await fs.rm(root, {
      recursive: true,
      force: true
    })
  }
}
