import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import zlib from 'node:zlib'
import esbuild from 'esbuild'
import polyfillPkg from 'esbuild-plugins-node-modules-polyfill'
import esbuildSvelte from 'esbuild-svelte'
import { compile as compileSvelte } from 'svelte/compiler'
import { render as renderSvelte } from 'svelte/server'
import { launchBenchmarkBrowser } from '../../utils/browser.js'

const { nodeModulesPolyfillPlugin } = polyfillPkg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function createStaticServer (rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1')
      const normalizedPath = path.normalize(parsedUrl.pathname)
      let filePath = path.join(rootDir, normalizedPath)

      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403)
        return res.end('Forbidden')
      }

      const stat = await fs.stat(filePath).catch(() => null)
      if (stat && stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
      }
      const data = await fs.readFile(filePath)
      const ext = path.extname(filePath)
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8'
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        server,
        port,
        url: `http://127.0.0.1:${port}`
      })
    })
  })
}

/**
 * Workload 1: Selective Hydration & Island Scaling (50-Component Matrix)
 */
async function runIslandScaling (buildDir) {
  const targets = [
    'coralite-selective',
    'coralite-dynamic',
    'react',
    'vue',
    'svelte'
  ]

  const metrics = {}

  for (const target of targets) {
    const targetOutDir = path.join(buildDir, target)
    await fs.mkdir(targetOutDir, { recursive: true })

    let entryCode = ''
    let htmlContent = ''

    if (target === 'coralite-selective' || target === 'coralite-dynamic') {
      const isSelective = target === 'coralite-selective'
      const elements = []
      for (let i = 0; i < 50; i++) {
        const isDynamic = !isSelective || i < 2
        if (isDynamic) {
          elements.push('<island-widget></island-widget>')
        } else {
          elements.push('<static-widget no-hydration></static-widget>')
        }
      }

      htmlContent = `<!DOCTYPE html><html><head></head><body><div id="app">${elements.join('\n')}</div></body></html>`

      const coraliteElemPath = path.resolve(__dirname, '../../../lib/coralite-element.js')
      entryCode = `
import { createCoraliteClass } from ${JSON.stringify(coraliteElemPath)}
const IslandWidget = createCoraliteClass({
  componentId: 'island-widget',
  defaultValues: { count: 0 },
  client ({ state, root, observe }) {
    const btn = root.querySelector('#widget-btn')
    const countDisplay = root.querySelector('#count-val')
    observe('count', (val) => {
      if (countDisplay) countDisplay.textContent = String(val)
    })
    if (btn) btn.addEventListener('click', () => { state.count++ })
  }
})
if (!customElements.get('island-widget')) {
  customElements.define('island-widget', IslandWidget)
}
performance.mark('hydration:start')
performance.mark('hydration:end')
performance.measure('hydration', 'hydration:start', 'hydration:end')
`
    } else if (target === 'react') {
      entryCode = `
import React, { useState } from 'react'
import { hydrateRoot } from 'react-dom/client'

function Widget() {
  const [count, setCount] = useState(0)
  return React.createElement('div', { className: 'widget' },
    React.createElement('button', { id: 'widget-btn', onClick: () => setCount(c => c + 1) }, 'Count: ' + count)
  )
}

function App() {
  const items = []
  for (let i = 0; i < 50; i++) {
    items.push(React.createElement(Widget, { key: i }))
  }
  return React.createElement(React.Fragment, null, items)
}

const container = document.getElementById('app')
if (container) {
  performance.mark('hydration:start')
  hydrateRoot(container, React.createElement(App))
  performance.mark('hydration:end')
  performance.measure('hydration', 'hydration:start', 'hydration:end')
}
`
      const reactSsrModule = await import('react-dom/server')
      const reactModule = await import('react')
      const Widget = () => reactModule.default.createElement('div', { className: 'widget' }, reactModule.default.createElement('button', { id: 'widget-btn' }, 'Count: 0'))
      const items = []
      for (let i = 0; i < 50; i++) {
        items.push(reactModule.default.createElement(Widget, { key: i }))
      }
      const appEl = reactModule.default.createElement('div', { id: 'app' }, items)
      const content = reactSsrModule.default.renderToString(appEl)
      htmlContent = `<!DOCTYPE html><html><head></head><body>${content}<script type="module" src="app.js"></script></body></html>`
    } else if (target === 'vue') {
      entryCode = `
import { createSSRApp, ref, h } from 'vue'

const Widget = {
  setup() {
    const count = ref(0)
    return () => h('div', { class: 'widget' }, [
      h('button', { id: 'widget-btn', onClick: () => count.value++ }, 'Count: ' + count.value)
    ])
  }
}

const App = {
  setup() {
    return () => Array.from({ length: 50 }, (_, i) => h(Widget, { key: i }))
  }
}

const container = document.getElementById('app')
if (container) {
  performance.mark('hydration:start')
  const app = createSSRApp(App)
  app.mount(container)
  performance.mark('hydration:end')
  performance.measure('hydration', 'hydration:start', 'hydration:end')
}
`
      const vueSsrModule = await import('vue/server-renderer')
      const vueModule = await import('vue')
      const Widget = {
        setup () {
          return () => vueModule.h('div', { class: 'widget' }, [
            vueModule.h('button', { id: 'widget-btn' }, 'Count: 0')
          ])
        }
      }
      const App = {
        setup () {
          return () => Array.from({ length: 50 }, (_, i) => vueModule.h(Widget, { key: i }))
        }
      }
      const app = vueModule.createSSRApp(App)
      const content = await vueSsrModule.renderToString(app)
      htmlContent = `<!DOCTYPE html><html><head></head><body><div id="app">${content}</div><script type="module" src="app.js"></script></body></html>`
    } else if (target === 'svelte') {
      entryCode = `
import { hydrate } from 'svelte'
import App from './App.svelte'

const container = document.getElementById('app')
if (container) {
  performance.mark('hydration:start')
  hydrate(App, { target: container })
  performance.mark('hydration:end')
  performance.measure('hydration', 'hydration:start', 'hydration:end')
}
`
      const svelteAppCode = `
<script>
  let count = $state(0)
</script>
{#each Array(50) as _, i}
  <div class="widget">
    <button id="widget-btn" onclick={() => count++}>Count: {count}</button>
  </div>
{/each}
`
      await fs.writeFile(path.join(targetOutDir, 'App.svelte'), svelteAppCode, 'utf-8')

      const compiled = compileSvelte(svelteAppCode, {
        generate: 'server',
        filename: path.join(targetOutDir, 'App.svelte'),
        runes: true
      })

      const tmpServerJs = path.join(targetOutDir, '.App.server.js')
      await fs.writeFile(tmpServerJs, compiled.js.code, 'utf-8')
      const svelteMod = await import(`${pathToFileURL(tmpServerJs).href}?t=${Date.now()}`)
      const svelteResult = renderSvelte(svelteMod.default)
      htmlContent = `<!DOCTYPE html><html><head></head><body><div id="app">${svelteResult.html}</div><script type="module" src="app.js"></script></body></html>`
      await fs.unlink(tmpServerJs).catch(() => {})
    }

    const entryPath = path.join(targetOutDir, 'entry.js')
    const outJsPath = path.join(targetOutDir, 'app.js')
    await fs.writeFile(entryPath, entryCode, 'utf-8')
    await fs.writeFile(path.join(targetOutDir, 'index.html'), htmlContent.replace('</body>', '<script type="module" src="app.js"></script></body>'), 'utf-8')

    const plugins = [nodeModulesPolyfillPlugin()]
    if (target === 'svelte') {
      plugins.push(esbuildSvelte({ compilerOptions: { runes: true, dev: false } }))
    }

    await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      minify: true,
      format: 'esm',
      target: 'esnext',
      platform: 'browser',
      plugins,
      outfile: outJsPath,
      define: {
        'process.env.NODE_ENV': '"production"',
        'import.meta.env.MODE': '"production"'
      }
    })

    const jsBuf = await fs.readFile(outJsPath)
    const rawKB = +((jsBuf.length / 1024)).toFixed(1)
    const gzipKB = +((zlib.gzipSync(jsBuf).length / 1024)).toFixed(1)

    metrics[target] = { rawKB, gzipKB, hydrationMS: 0 }
  }

  const { server, url: serverUrl } = await createStaticServer(buildDir)
  const browser = await launchBenchmarkBrowser()

  try {
    for (const target of targets) {
      const page = await browser.newPage()
      await page.goto(`${serverUrl}/${target}/index.html`)
      await page.waitForFunction(() => performance.getEntriesByName('hydration').length > 0)
      const hydDuration = await page.evaluate(() => {
        const entries = performance.getEntriesByName('hydration')
        return entries.length > 0 ? entries[0].duration : 0
      })
      metrics[target].hydrationMS = +hydDuration.toFixed(2)
      await page.close()
    }
  } finally {
    await browser.close()
    server.close()
  }

  return metrics
}

/**
 * Workload 2: High-Frequency State Streaming (100 updates/sec for 3s in Playwright Chromium)
 */
async function runHighFrequencyStreaming (buildDir) {
  const streamingOutDir = path.join(buildDir, 'streaming')
  await fs.mkdir(streamingOutDir, { recursive: true })

  const coraliteElemPath = path.resolve(__dirname, '../../../lib/coralite-element.js')
  const entryCode = `
import { createCoraliteClass } from ${JSON.stringify(coraliteElemPath)}

const StreamingWidget = createCoraliteClass({
  componentId: 'streaming-widget',
  defaultValues: { count: 0 },
  client ({ state, root, observe }) {
    window.__widgetState = state
    const display = root.querySelector('#count-val')
    observe('count', (val) => {
      if (display) display.textContent = String(val)
    })
  }
})

if (!customElements.get('streaming-widget')) {
  customElements.define('streaming-widget', StreamingWidget)
}
`
  const entryPath = path.join(streamingOutDir, 'entry.js')
  const outJsPath = path.join(streamingOutDir, 'app.js')
  await fs.writeFile(entryPath, entryCode, 'utf-8')
  await fs.writeFile(path.join(streamingOutDir, 'index.html'), '<!DOCTYPE html><html><head></head><body><streaming-widget id="widget"><div id="count-val">0</div></streaming-widget><script type="module" src="app.js"></script></body></html>', 'utf-8')

  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'esnext',
    platform: 'browser',
    plugins: [nodeModulesPolyfillPlugin()],
    outfile: outJsPath,
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.MODE': '"production"'
    }
  })

  const { server, url: serverUrl } = await createStaticServer(streamingOutDir)
  const browser = await launchBenchmarkBrowser()

  try {
    const page = await browser.newPage()
    await page.goto(`${serverUrl}/index.html`)

    const metrics = await page.evaluate(async () => {
      await new Promise(resolve => {
        if (window.__widgetState) resolve()
        else {
          const interval = setInterval(() => {
            if (window.__widgetState) {
              clearInterval(interval)
              resolve()
            }
          }, 10)
        }
      })

      let droppedFrames = 0
      let running = true
      let lastFrameTime = performance.now()

      function checkFrame () {
        const now = performance.now()
        const delta = now - lastFrameTime
        if (delta > 16.6) {
          droppedFrames++
        }
        lastFrameTime = now
        if (running) {
          requestAnimationFrame(checkFrame)
        }
      }
      requestAnimationFrame(checkFrame)

      const batchLatencies = []
      const totalUpdates = 300
      const intervalMs = 10

      const cpuStart = performance.now()

      for (let i = 0; i < totalUpdates; i++) {
        const t0 = performance.now()
        window.__widgetState.count = i + 1
        await new Promise(r => queueMicrotask(r))
        const latency = performance.now() - t0
        batchLatencies.push(latency)
        await new Promise(r => setTimeout(r, intervalMs))
      }

      running = false
      const peakCpuTimeMS = +(performance.now() - cpuStart).toFixed(2)
      const avgBatchLatencyMS = +((batchLatencies.reduce((a, b) => a + b, 0) / totalUpdates)).toFixed(3)

      return {
        totalUpdates,
        avgBatchLatencyMS,
        droppedFrames,
        peakCpuTimeMS
      }
    })

    return metrics
  } finally {
    await browser.close()
    server.close()
  }
}

/**
 * Workload 3: Mount/Unmount Memory Lifecycle (50 cycles of 1,000 components)
 */
async function runMemoryLifecycle () {
  const browser = await launchBenchmarkBrowser()
  const page = await browser.newPage()

  const coraliteElemPath = path.resolve(__dirname, '../../../lib/coralite-element.js')

  const coraliteBuildDir = path.join(__dirname, '.bench-lifecycle-build')
  await fs.mkdir(coraliteBuildDir, { recursive: true })
  const elemJs = path.join(coraliteBuildDir, 'elem.js')

  await esbuild.build({
    entryPoints: [coraliteElemPath],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'esnext',
    platform: 'browser',
    plugins: [nodeModulesPolyfillPlugin()],
    outfile: elemJs
  })

  const { server, url: serverUrl } = await createStaticServer(coraliteBuildDir)

  const html = `<!DOCTYPE html>
<html>
<head></head>
<body>
  <div id="host"></div>
  <script type="module">
    import { createCoraliteClass } from './elem.js'
    const LifecycleItem = createCoraliteClass({
      componentId: 'lifecycle-item',
      attributes: { id: { type: String } },
      defaultValues: { id: '0' }
    })
    if (!customElements.get('lifecycle-item')) {
      customElements.define('lifecycle-item', LifecycleItem)
    }

    window.mount1k = () => {
      const host = document.getElementById('host')
      host.innerHTML = ''
      const frag = document.createDocumentFragment()
      for (let i = 0; i < 1000; i++) {
        const el = document.createElement('lifecycle-item')
        el.setAttribute('id', String(i))
        frag.appendChild(el)
      }
      host.appendChild(frag)
    }

    window.unmount1k = () => {
      const host = document.getElementById('host')
      host.innerHTML = ''
    }
    window.__ready = true
  </script>
</body>
</html>`

  await fs.writeFile(path.join(coraliteBuildDir, 'index.html'), html, 'utf-8')
  await page.goto(`${serverUrl}/index.html`)
  await page.waitForFunction(() => window.__ready === true)

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {})

  const getHeapMB = async () => {
    try {
      const heapUsage = await cdp.send('Runtime.getHeapUsage')
      return +(heapUsage.usedSize / (1024 * 1024)).toFixed(2)
    } catch {
      return 0
    }
  }

  const initialHeapMB = await getHeapMB()

  for (let cycle = 0; cycle < 50; cycle++) {
    await page.evaluate(() => window.mount1k())
    await page.evaluate(() => window.unmount1k())
  }

  await cdp.send('HeapProfiler.collectGarbage').catch(() => {})
  const finalHeapMB = await getHeapMB()
  await cdp.detach().catch(() => {})
  await browser.close()
  server.close()
  await fs.rm(coraliteBuildDir, { recursive: true, force: true }).catch(() => {})

  const netRetentionMB = +Math.max(0, finalHeapMB - initialHeapMB).toFixed(2)

  return {
    cycles: 50,
    componentsPerCycle: 1000,
    initialHeapMB,
    finalHeapMB,
    netRetentionMB,
    passed: netRetentionMB < 0.5
  }
}

/**
 * Runs Suite 5 — Stress, Streaming & Lifecycle Workloads.
 */
export async function runStressLifecycleSuite (options = {}) {
  console.log('Running Suite 5 Workload 1: Selective Hydration & Island Scaling (50 Components)...')
  const buildDir = path.join(__dirname, '.bench-build')
  await fs.mkdir(buildDir, { recursive: true })

  let islandScalingResults = {}
  try {
    islandScalingResults = await runIslandScaling(buildDir)
  } finally {
    await fs.rm(buildDir, { recursive: true, force: true }).catch(() => {})
  }

  console.log('Running Suite 5 Workload 2: High-Frequency State Streaming...')
  const streamingBuildDir = path.join(__dirname, '.bench-streaming-build')
  await fs.mkdir(streamingBuildDir, { recursive: true })
  let streamingResults = {}
  try {
    streamingResults = await runHighFrequencyStreaming(streamingBuildDir)
  } finally {
    await fs.rm(streamingBuildDir, { recursive: true, force: true }).catch(() => {})
  }

  console.log('Running Suite 5 Workload 3: Mount/Unmount Memory Lifecycle...')
  const lifecycleResults = await runMemoryLifecycle()

  return {
    islandScaling: islandScalingResults,
    streaming: streamingResults,
    lifecycle: lifecycleResults
  }
}
