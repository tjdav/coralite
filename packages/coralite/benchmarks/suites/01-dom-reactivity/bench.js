import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import polyfillPkg from 'esbuild-plugins-node-modules-polyfill'
import { launchBenchmarkBrowser } from '../../utils/browser.js'

const { nodeModulesPolyfillPlugin } = polyfillPkg
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function calculateMedian (numbers) {
  if (!numbers || numbers.length === 0) {
    return 0
  }
  const sample = numbers.length > 1 ? numbers.slice(1) : numbers
  const sorted = [...sample].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
  }
  return +sorted[mid].toFixed(2)
}

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

async function bundleApps (buildDir) {
  await fs.mkdir(buildDir, { recursive: true })
  const frameworks = ['vanilla', 'coralite', 'react', 'vue']

  for (const fw of frameworks) {
    const fwOutDir = path.join(buildDir, fw)
    await fs.mkdir(fwOutDir, { recursive: true })

    const appSourceDir = path.join(__dirname, 'apps', fw)
    const entryFile = fw === 'react' ? path.join(appSourceDir, 'app.jsx') : path.join(appSourceDir, 'app.js')

    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      minify: true,
      format: 'esm',
      target: 'esnext',
      platform: 'browser',
      plugins: [nodeModulesPolyfillPlugin()],
      outfile: path.join(fwOutDir, 'app.js'),
      define: {
        'process.env.NODE_ENV': '"production"',
        'import.meta.env.MODE': '"production"'
      },
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx'
      }
    })

    const html = await fs.readFile(path.join(appSourceDir, 'index.html'), 'utf-8')
    await fs.writeFile(path.join(fwOutDir, 'index.html'), html, 'utf-8')
  }
}

/**
 *
 */
export async function runDomReactivitySuite (options = {}) {
  const iterations = options.iterations || 9
  const rows = options.rows || 1000
  const buildDir = path.join(__dirname, '.bench-build')

  console.log('Bundling benchmark applications...')
  await bundleApps(buildDir)

  console.log('Starting static benchmark server...')
  const { server, url: serverUrl } = await createStaticServer(buildDir)

  console.log('Launching benchmark browser...')
  const browser = await launchBenchmarkBrowser()

  const frameworks = ['coralite', 'react', 'vue', 'vanilla']
  const results = {}

  try {
    for (const fw of frameworks) {
      console.log(`Running DOM reactivity benchmark for framework: ${fw}...`)
      const page = await browser.newPage()

      const pageErrors = []
      page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err))
      })
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          pageErrors.push(msg.text())
        }
      })

      await page.goto(`${serverUrl}/${fw}/index.html`)

      const runBtnId = rows === 10000 ? '#runlots' : '#run'

      await page.waitForFunction((selector) => {
        const docBtn = document.querySelector(selector)
        const compBtn = document.querySelector('coralite-app')?.querySelector(selector)
        const shadowBtn = document.querySelector('coralite-app')?.shadowRoot?.querySelector(selector)
        return Boolean(docBtn || compBtn || shadowBtn)
      }, runBtnId)

      const measureClickToPaint = async (selector, expectedRowCount) => {
        pageErrors.length = 0

        const duration = await page.evaluate(async (btnSelector) => {
          const start = performance.now()
          let btn = document.querySelector(btnSelector)
          if (!btn) {
            btn = document.querySelector('coralite-app')?.querySelector(btnSelector)
          }
          if (!btn && document.querySelector('coralite-app')?.shadowRoot) {
            btn = document.querySelector('coralite-app').shadowRoot.querySelector(btnSelector)
          }
          if (!btn) {
            throw new Error(`Target button selector "${btnSelector}" not found in DOM`)
          }
          btn.click()
          await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
          return performance.now() - start
        }, selector)

        if (pageErrors.length > 0) {
          throw new Error(`[${fw}] Runtime error during ${selector}: ${pageErrors.join('; ')}`)
        }

        if (expectedRowCount !== undefined) {
          const actualCount = await page.evaluate(() => {
            const tbody = document.querySelector('tbody') ||
              document.querySelector('coralite-app')?.querySelector('tbody') ||
              document.querySelector('coralite-app')?.shadowRoot?.querySelector('tbody')
            return tbody ? tbody.children.length : 0
          })
          if (actualCount !== expectedRowCount) {
            throw new Error(`[${fw}] Row count mismatch after ${selector}: expected ${expectedRowCount}, got ${actualCount}`)
          }
        }

        return duration
      }

      // Warmup pass
      await measureClickToPaint(runBtnId, rows)
      await measureClickToPaint('#replace', rows)
      await measureClickToPaint('#update', rows)
      await measureClickToPaint('#swaprows', rows)
      await measureClickToPaint('#clear', 0)

      const createKey = rows === 10000 ? 'create10k' : 'create1k'
      const replaceKey = rows === 10000 ? 'replace10k' : 'replace1k'

      const timings = {
        [createKey]: [],
        [replaceKey]: [],
        update10th: [],
        swapRows: [],
        clear: []
      }

      for (let i = 0; i < iterations; i++) {
        // Ensure starting clean
        await measureClickToPaint('#clear', 0)

        const createTime = await measureClickToPaint(runBtnId, rows)
        timings[createKey].push(createTime)

        const replaceTime = await measureClickToPaint('#replace', rows)
        timings[replaceKey].push(replaceTime)

        const updateTime = await measureClickToPaint('#update', rows)
        timings.update10th.push(updateTime)

        const swapTime = await measureClickToPaint('#swaprows', rows)
        timings.swapRows.push(swapTime)

        const clearTime = await measureClickToPaint('#clear', 0)
        timings.clear.push(clearTime)
      }

      // Populate dataset for Heap Memory Measurement
      await measureClickToPaint(runBtnId, rows)

      const cdp = await page.context().newCDPSession(page)
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {})

      let heapBytes = 0
      try {
        const heapUsage = await cdp.send('Runtime.getHeapUsage')
        heapBytes = heapUsage.usedSize || 0
      } catch {
        const metrics = await cdp.send('Performance.getMetrics').catch(() => null)
        const jsHeapMetric = metrics?.metrics?.find(m => m.name === 'JSHeapUsedSize')
        heapBytes = jsHeapMetric ? jsHeapMetric.value : await page.evaluate(() => window.performance?.memory?.usedJSHeapSize || 0)
      }

      await cdp.detach().catch(() => {})
      const heapMB = +(heapBytes / (1024 * 1024)).toFixed(2)

      results[fw] = {
        [createKey]: calculateMedian(timings[createKey]),
        [replaceKey]: calculateMedian(timings[replaceKey]),
        update10th: calculateMedian(timings.update10th),
        swapRows: calculateMedian(timings.swapRows),
        clear: calculateMedian(timings.clear),
        heapMB
      }

      await page.close()
    }
  } finally {
    await browser.close()
    server.close()
    await fs.rm(buildDir, {
      recursive: true,
      force: true
    }).catch(() => {
    })
  }

  return results
}
