import { Coralite } from '../lib/index.js'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMP_DIR = join(__dirname, 'temp')
const TEMPLATES_DIR = join(TEMP_DIR, 'templates')
const PAGES_DIR = join(TEMP_DIR, 'pages')

// Configuration
const COMPONENT_DELAY_MS = 10
const COMPONENT_COUNT = 100

async function setup () {
  await rm(TEMP_DIR, {
    recursive: true,
    force: true
  })
  await mkdir(TEMPLATES_DIR, { recursive: true })
  await mkdir(PAGES_DIR, { recursive: true })

  // Create async component
  const componentContent = `
<template id="async-comp">
  <div class="async-comp">Rendered after delay</div>
</template>

<script type="module">
  import { defineComponent } from 'coralite'

  export default defineComponent({
    async script() {
      await new Promise(resolve => setTimeout(resolve, ${COMPONENT_DELAY_MS}))
    }
  })
</script>
  `
  await writeFile(join(TEMPLATES_DIR, 'async-comp.html'), componentContent)

  // Create page with many instances
  const instances = Array(COMPONENT_COUNT).fill('<async-comp></async-comp>').join('\n    ')
  const pageContent = `
<!DOCTYPE html>
<html>
  <body>
    <h1>Async Performance Test</h1>
    ${instances}
  </body>
</html>
  `
  await writeFile(join(PAGES_DIR, 'index.html'), pageContent)
}

async function runBenchmark () {
  console.log('Setting up benchmark...')
  await setup()

  console.log(`\nBenchmark Configuration:`)
  console.log(`- Component Delay: ${COMPONENT_DELAY_MS}ms`)
  console.log(`- Component Count: ${COMPONENT_COUNT}`)
  console.log(`- Theoretical Serial Time: ${COMPONENT_DELAY_MS * COMPONENT_COUNT}ms`)

  const coralite = new Coralite({
    templates: TEMPLATES_DIR,
    pages: PAGES_DIR
  })

  console.log('\nInitializing Coralite...')
  await coralite.initialise()

  console.log('Building page...')
  const start = performance.now()
  const results = await coralite.build()
  const end = performance.now()

  const duration = end - start
  console.log(`\nResults:`)
  console.log(`- Build Duration: ${duration.toFixed(2)}ms`)

  if (results && results.length > 0) {
    console.log(`- Pages Built: ${results.length}`)
    const html = results[0].html
    const matchCount = (html.match(/class="async-comp"/g) || []).length
    console.log(`- Rendered Components: ${matchCount} / ${COMPONENT_COUNT}`)

    if (matchCount !== COMPONENT_COUNT) {
      console.error('⚠️  Warning: Component count mismatch!')
    }
  } else {
    console.error('⚠️  Warning: No results returned!')
  }

  // Cleanup
  await rm(TEMP_DIR, {
    recursive: true,
    force: true
  })
}

runBenchmark().catch(console.error)
