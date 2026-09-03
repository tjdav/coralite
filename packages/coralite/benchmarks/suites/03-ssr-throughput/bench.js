import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import createCoralite from '#lib'
import { triggerGC, getMemoryUsage } from '../../utils/memory.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function createBenchmarkApp (workDir, pageCount) {
  const componentsDir = path.join(workDir, 'components')
  const pagesDir = path.join(workDir, 'pages')
  const outputDir = path.join(workDir, 'dist')

  await fs.mkdir(componentsDir, { recursive: true })
  await fs.mkdir(pagesDir, { recursive: true })

  // 1. Create nested leaf component (nested-card.html)
  const nestedCardContent = `
<template id="nested-card">
  <div class="nested-card">
    <span class="card-title">{{ title }}</span>
    <span class="card-count">{{ count }}</span>
  </div>
</template>

<script type="module">
import { defineComponent } from 'coralite'

export default defineComponent({
  attributes: {
    title: String,
    count: Number
  },
  getters: {
    formattedCount ({ state }) {
      return '#' + (state.count || 0)
    }
  }
})
</script>
`
  await fs.writeFile(path.join(componentsDir, 'nested-card.html'), nestedCardContent, 'utf-8')

  // 2. Create dynamic container component (user-profile.html)
  const userProfileContent = `
<template id="user-profile">
  <div class="user-profile">
    <h2>{{ username }}</h2>
    <p>{{ bio }}</p>
    <nested-card title="Score" count="{{ score }}"></nested-card>
    <nested-card title="Rank" count="{{ rank }}"></nested-card>
  </div>
</template>

<script type="module">
import { defineComponent } from 'coralite'

export default defineComponent({
  attributes: {
    username: String,
    bio: String,
    score: Number,
    rank: Number
  },
  server (context) {
    return {
      serverTimestamp: Date.now()
    }
  }
})
</script>
`
  await fs.writeFile(path.join(componentsDir, 'user-profile.html'), userProfileContent, 'utf-8')

  // 3. Generate pages containing nested components
  for (let i = 0; i < pageCount; i++) {
    const pageContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Page ${i}</title>
</head>
<body>
  <main>
    <h1>Welcome to Page ${i}</h1>
    <user-profile username="User_${i}" bio="Bio for user ${i}" score="${i * 10}" rank="${i + 1}"></user-profile>
  </main>
</body>
</html>
`
    await fs.writeFile(path.join(pagesDir, `page-${i}.html`), pageContent, 'utf-8')
  }

  const app = await createCoralite({
    components: componentsDir,
    pages: pagesDir,
    output: outputDir,
    mode: 'production',
    incremental: false
  })

  return {
    app,
    outputDir
  }
}

/**
 * Runs the SSR throughput benchmark suite across 100, 1,000, and 10,000 page workloads.
 *
 * @param {Object} [options] - Suite options
 * @returns {Promise<Object>} Benchmark metrics keyed by workload (100_pages, 1000_pages, 10000_pages)
 */
export async function runSSRThroughputSuite (options = {}) {
  const workloads = [100, 1000, 10000]
  const results = {}

  for (const count of workloads) {
    console.log(`Running SSR throughput benchmark for ${count.toLocaleString()} pages...`)
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `coralite-bench-ssr-${count}-`))

    try {
      triggerGC()
      const startMem = getMemoryUsage().heapUsedMB

      const { app } = await createBenchmarkApp(tempDir, count)

      const startTime = performance.now()
      await app.build()
      const totalDurationMS = +(performance.now() - startTime).toFixed(1)

      triggerGC()
      const endMem = getMemoryUsage().heapUsedMB
      const heapUsedMB = +Math.max(0, endMem - startMem).toFixed(1) || endMem

      const pagesPerSec = +((count / (totalDurationMS / 1000))).toFixed(1)
      const avgLatencyMS = +((totalDurationMS / count)).toFixed(2)

      const key = `${count}_pages`
      results[key] = {
        totalPages: count,
        totalDurationMS,
        pagesPerSec,
        avgLatencyMS,
        heapUsedMB
      }
    } finally {
      await fs.rm(tempDir, {
        recursive: true,
        force: true
      }).catch(() => {
      })
    }
  }

  return results
}
