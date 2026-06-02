import { bench, run } from 'mitata'
import { createCoralite } from '../lib/index.js'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, rmSync } from 'node:fs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const componentsDir = join(__dirname, 'temp-waterfall-components')
const pagesDir = join(__dirname, 'temp-waterfall-pages')

mkdirSync(componentsDir, { recursive: true })
mkdirSync(pagesDir, { recursive: true })

const HOOK_COUNT = 100

// Setup synchronous and asynchronous baseline arrays
const syncFns = Array.from({ length: HOOK_COUNT }, () => (ctx) => ({ test: true }))
const asyncFns = Array.from({ length: HOOK_COUNT }, () => async (ctx) => ({ test: true }))

// Setup coralite instances for testing framework waterfall
const syncPlugins = syncFns.map((fn, i) => ({
  name: `sync-plugin-${i}`,
  onBeforePageRender: fn
}))
const asyncPlugins = asyncFns.map((fn, i) => ({
  name: `async-plugin-${i}`,
  onBeforePageRender: fn
}))

const syncCoralite = await createCoralite({
  components: componentsDir,
  pages: pagesDir,
  output: '.coralite',
  plugins: syncPlugins
})

const asyncCoralite = await createCoralite({
  components: componentsDir,
  pages: pagesDir,
  plugins: asyncPlugins
})


const baseContext = {
  values: {},
  component: {}
}

console.log(`\nBenchmark: Hook Waterfall Chain (${HOOK_COUNT} plugins)`)
console.log('--------------------------------------------------')

bench('_triggerPluginHook (Framework - Sync)', async () => {
  // @ts-ignore
  await syncCoralite._triggerPluginHook('onBeforePageRender', baseContext, {})
})

bench('Raw Array for Loop (Baseline - Sync)', () => {
  let ctx = { ...baseContext }
  for (let i = 0; i < syncFns.length; i++) {
    const patch = syncFns[i](ctx)
    Object.assign(ctx, patch)
  }
})

bench('_triggerPluginHook (Framework - Async)', async () => {
  // @ts-ignore
  await asyncCoralite._triggerPluginHook('onBeforePageRender', baseContext, {})
})

bench('Raw Array for Loop (Baseline - Async)', async () => {
  let ctx = { ...baseContext }
  for (let i = 0; i < asyncFns.length; i++) {
    const patch = await asyncFns[i](ctx)
    Object.assign(ctx, patch)
  }
})

await run()

rmSync(componentsDir, {
  recursive: true,
  force: true
})
rmSync(pagesDir, {
  recursive: true,
  force: true
})
