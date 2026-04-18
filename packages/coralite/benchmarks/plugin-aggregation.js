import { bench, run } from 'mitata'
import { Coralite } from '../lib/index.js'

const TOTAL_PAGES = 10000

// Simulate an array of pages
const dummyPages = Array.from({ length: TOTAL_PAGES }, (_, i) => ({
  path: `/page-${i}.html`,
  html: `<h1>Page ${i}</h1>`
}))

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkdirSync, rmSync } from 'node:fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const componentsDir = join(__dirname, 'temp-components')
const pagesDir = join(__dirname, 'temp-pages')

mkdirSync(componentsDir, { recursive: true })
mkdirSync(pagesDir, { recursive: true })

const coralite = new Coralite({
  components: componentsDir,
  pages: pagesDir,
  plugins: [{
    name: 'pagination-plugin',
    onAfterPageRender () {
      return dummyPages
    }
  }]
})
await coralite.initialise()

// A dummy base context array
const baseContext = [{
  path: '/index.html',
  html: '<h1>Index</h1>'
}]

console.log(`\nBenchmark: Plugin Data Aggregation`)
console.log('--------------------------------------------------')

bench('_triggerPluginAggregateHook (Framework)', async () => {
  await coralite._triggerPluginAggregateHook('onAfterPageRender', baseContext)
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
