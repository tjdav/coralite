import { bench, run } from 'mitata'
import { createCoralite } from '../lib/index.js'

const TOTAL_PAGES = 10000

// Simulate an array of pages
/** @type {any[]} */
const dummyPages = Array.from({ length: TOTAL_PAGES }, (_, i) => ({
  type: 'page',
  path: { pathname: `/page-${i}.html` },
  content: `<h1>Page ${i}</h1>`
}))

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkdirSync, rmSync } from 'node:fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const componentsDir = join(__dirname, 'temp-components')
const pagesDir = join(__dirname, 'temp-pages')

mkdirSync(componentsDir, { recursive: true })
mkdirSync(pagesDir, { recursive: true })

const coralite = await createCoralite({
  components: componentsDir,
  pages: pagesDir,
  plugins: [{
    name: 'pagination-plugin',
    server: {
      onAfterPageRender ({ result, session }) {
        return Promise.resolve(dummyPages)
      }
    }
  }]
})

// A dummy base context array
/** @type {any[]} */
const baseContext = [{
  type: 'page',
  path: { pathname: '/index.html' },
  content: '<h1>Index</h1>'
}]

console.log(`\nBenchmark: Plugin Data Aggregation`)
console.log('--------------------------------------------------')

bench('_triggerPluginAggregateHook (Framework)', async () => {
  await coralite._triggerPluginAggregateHook('onAfterPageRender', {
    result: baseContext,
    session: {}
  })
})

bench('Array.prototype.concat (Baseline)', () => {
  let result = [].concat(baseContext)
  result = result.concat(dummyPages)
  return result
})

await run()

// Cleanup
rmSync(componentsDir, {
  recursive: true,
  force: true
})
rmSync(pagesDir, {
  recursive: true,
  force: true
})
