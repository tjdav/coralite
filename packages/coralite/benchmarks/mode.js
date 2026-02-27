import { Coralite } from '../lib/index.js'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMP_DIR = join(__dirname, 'temp-benchmark')
const TEMPLATES_DIR = join(TEMP_DIR, 'templates')
const PAGES_DIR = join(TEMP_DIR, 'pages')

// Check for required VM modules
if (!process.execArgv.includes('--experimental-vm-modules')) {
  console.warn('⚠️  Warning: Development mode requires Node.js with --experimental-vm-modules.')
  console.warn('   Run with: node --experimental-vm-modules benchmarks/mode-comparison.js')
}

// Memory measurement helper
function getMemoryUsage () {
  const usage = process.memoryUsage()
  return {
    rss: (usage.rss / 1024 / 1024).toFixed(2) + ' MB',
    heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
    heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
    external: (usage.external / 1024 / 1024).toFixed(2) + ' MB'
  }
}

// File generation helpers
async function setup (scenario) {
  // Ensure fresh start
  await cleanup()

  await mkdir(TEMPLATES_DIR, { recursive: true })
  await mkdir(PAGES_DIR, { recursive: true })

  // 1. Generate Components based on complexity
  const componentCount = scenario.components || 5

  for (let i = 0; i < componentCount; i++) {
    const componentContent = `
<template id="comp-${i}">
  <div class="comp-${i}">
    <h3>Component ${i}</h3>
    <p>This is a component with some dynamic content.</p>
    <slot></slot>
  </div>
</template>

<script type="module">
  export default {
    data() {
      return { id: ${i}, timestamp: Date.now() }
    }
  }
</script>

<style>
  .comp-${i} { border: 1px solid #ccc; padding: 10px; margin: 5px; }
</style>
    `
    await writeFile(join(TEMPLATES_DIR, `comp-${i}.html`), componentContent)
  }

  // 2. Generate Pages based on count and complexity
  const pageCount = scenario.pages || 10
  const componentsPerPage = scenario.componentsPerPage || 2

  for (let i = 0; i < pageCount; i++) {
    let pageBody = ''
    for (let j = 0; j < componentsPerPage; j++) {
      const compId = j % componentCount
      pageBody += `<comp-${compId}>Page ${i} Content ${j}</comp-${compId}>\n`
    }

    const pageContent = `
<!DOCTYPE html>
<html>
  <head>
    <title>Page ${i}</title>
  </head>
  <body>
    <h1>Benchmark Page ${i}</h1>
    ${pageBody}
  </body>
</html>
    `
    // Create nested structure for variety if page count is high
    if (pageCount > 50 && i % 10 === 0) {
      const nestedDir = join(PAGES_DIR, `section-${i}`)
      await mkdir(nestedDir, { recursive: true })
      await writeFile(join(nestedDir, 'index.html'), pageContent)
    } else {
      await writeFile(join(PAGES_DIR, `page-${i}.html`), pageContent)
    }
  }
}

async function cleanup () {
  await rm(TEMP_DIR, {
    recursive: true,
    force: true
  })
}

// Benchmark Runner
async function runBenchmark (mode, scenario) {
  console.log(`\nStarting Benchmark: ${scenario.name} [${mode}]`)
  console.log('--------------------------------------------------')

  // Setup files
  const setupStart = performance.now()
  await setup(scenario)
  const setupEnd = performance.now()
  // console.log(`Setup Time: ${(setupEnd - setupStart).toFixed(2)}ms`)

  // Initial Memory
  const memStart = getMemoryUsage()

  // Initialize Coralite
  const initStart = performance.now()
  const coralite = new Coralite({
    templates: TEMPLATES_DIR,
    pages: PAGES_DIR,
    mode: mode
  })

  await coralite.initialise()
  const initEnd = performance.now()
  const startupTime = (initEnd - initStart).toFixed(2)

  // First Build
  const buildStart = performance.now()
  const results = await coralite.build()
  const buildEnd = performance.now()
  const buildTime = (buildEnd - buildStart).toFixed(2)

  // Memory after build
  global.gc && global.gc() // Try to force GC if available for consistent results
  const memAfterBuild = getMemoryUsage()

  // Rebuild (simulating watch mode update or subsequent build)
  const rebuildStart = performance.now()
  await coralite.build()
  const rebuildEnd = performance.now()
  const rebuildTime = (rebuildEnd - rebuildStart).toFixed(2)

  // Report
  console.log(`Startup Time:   ${startupTime} ms`)
  console.log(`Build Time:     ${buildTime} ms (${results.length} pages)`)
  console.log(`Rebuild Time:   ${rebuildTime} ms`)

  console.log('\nMemory Usage (After Build):')
  console.table({
    RSS: memAfterBuild.rss,
    'Heap Total': memAfterBuild.heapTotal,
    'Heap Used': memAfterBuild.heapUsed,
    External: memAfterBuild.external
  })

  // Cleanup this run
  await cleanup()

  return {
    mode,
    scenario: scenario.name,
    startupTime,
    buildTime,
    rebuildTime,
    memory: memAfterBuild
  }
}

// Scenarios definition
const scenarios = [
  {
    name: 'Many Small Pages',
    pages: 1000,
    components: 5,
    componentsPerPage: 2
  },
  {
    name: 'Complex Pages',
    pages: 10,
    components: 50,
    componentsPerPage: 100 // Heavy DOM structure per page
  },
  {
    name: 'Mixed Workload',
    pages: 100,
    components: 20,
    componentsPerPage: 10
  }
]

async function main () {
  console.log('==================================================')
  console.log('Coralite Benchmark: Development vs Production')
  console.log('==================================================')

  const summary = []

  for (const scenario of scenarios) {
    // Run Development Mode
    try {
      const devResult = await runBenchmark('development', scenario)
      summary.push(devResult)
    } catch (e) {
      console.error(`Failed to run development mode for ${scenario.name}:`, e.message)
    }

    // Run Production Mode
    try {
      const prodResult = await runBenchmark('production', scenario)
      summary.push(prodResult)
    } catch (e) {
      console.error(`Failed to run production mode for ${scenario.name}:`, e.message)
    }
  }

  console.log('\n==================================================')
  console.log('FINAL SUMMARY COMPARISON')
  console.log('==================================================')

  // Group by scenario for easy comparison
  const grouped = {}
  summary.forEach(res => {
    if (!grouped[res.scenario]) grouped[res.scenario] = {}
    grouped[res.scenario][res.mode] = res
  })

  for (const [name, modes] of Object.entries(grouped)) {
    console.log(`\nScenario: ${name}`)
    if (modes.development && modes.production) {
      console.table({
        Metric: ['Startup (ms)', 'Build (ms)', 'Rebuild (ms)', 'Heap Used'],
        Development: [
          modes.development.startupTime,
          modes.development.buildTime,
          modes.development.rebuildTime,
          modes.development.memory.heapUsed
        ],
        Production: [
          modes.production.startupTime,
          modes.production.buildTime,
          modes.production.rebuildTime,
          modes.production.memory.heapUsed
        ],
        'Diff (Prod vs Dev)': [
          `${(modes.production.startupTime / modes.development.startupTime).toFixed(2)}x`,
          `${(modes.production.buildTime / modes.development.buildTime).toFixed(2)}x`,
          `${(modes.production.rebuildTime / modes.development.rebuildTime).toFixed(2)}x`,
          `${(parseFloat(modes.production.memory.heapUsed) / parseFloat(modes.development.memory.heapUsed)).toFixed(2)}x`
        ]
      })
    } else {
      console.log('Missing data for full comparison.')
    }
  }
}

main().catch(console.error)
