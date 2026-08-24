import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
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
  const sorted = [...numbers].sort((a, b) => a - b)
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

/**
 * Runs the bundle size and client hydration latency benchmark suite.
 *
 * @param {Object} [options] - Options for running the benchmark suite.
 * @param {number} [options.iterations=5] - Number of iterations per benchmark run.
 * @returns {Promise<Object>} Benchmark results
 */
export async function runBundleHydrationSuite (options = {}) {
  const iterations = options.iterations || 5
  const buildDir = path.join(__dirname, '.bench-build')
  await fs.mkdir(buildDir, { recursive: true })

  const frameworks = [
    {
      key: 'coraliteDynamic',
      appDir: 'coralite-dynamic',
      entry: 'app.js'
    },
    {
      key: 'coraliteStatic',
      appDir: 'coralite-static',
      entry: null
    },
    {
      key: 'react',
      appDir: 'react',
      entry: 'app.js'
    },
    {
      key: 'vue',
      appDir: 'vue',
      entry: 'app.js'
    }
  ]

  const bundleMetrics = {}

  console.log('Bundling and pre-rendering bundle-hydration applications...')

  for (const fw of frameworks) {
    const fwOutDir = path.join(buildDir, fw.key)
    await fs.mkdir(fwOutDir, { recursive: true })

    const appSourceDir = path.join(__dirname, 'apps', fw.appDir)
    const ssrModulePath = path.join(appSourceDir, 'ssr.js')
    const ssrModule = await import(`file://${ssrModulePath}`)
    const html = await ssrModule.renderHTML()
    await fs.writeFile(path.join(fwOutDir, 'index.html'), html, 'utf-8')

    if (fw.entry) {
      const entryFile = path.join(appSourceDir, fw.entry)
      const outFile = path.join(fwOutDir, 'app.js')

      await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        minify: true,
        format: 'esm',
        target: 'esnext',
        platform: 'browser',
        plugins: [nodeModulesPolyfillPlugin()],
        outfile: outFile,
        define: {
          'process.env.NODE_ENV': '"production"',
          'import.meta.env.MODE': '"production"'
        },
        loader: {
          '.js': 'jsx'
        }
      })

      const jsBuffer = await fs.readFile(outFile)
      const rawBytes = jsBuffer.length
      const gzipBytes = zlib.gzipSync(jsBuffer).length

      bundleMetrics[fw.key] = {
        rawKB: +((rawBytes / 1024)).toFixed(1),
        gzipKB: +((gzipBytes / 1024)).toFixed(1)
      }
    } else {
      bundleMetrics[fw.key] = {
        rawKB: 0.0,
        gzipKB: 0.0
      }
    }
  }

  console.log('Starting benchmark server...')
  const { server, url: serverUrl } = await createStaticServer(buildDir)

  console.log('Launching benchmark browser...')
  const browser = await launchBenchmarkBrowser()

  const results = {}

  try {
    for (const fw of frameworks) {
      console.log(`Measuring hydration and TTI for: ${fw.key}...`)

      if (fw.key === 'coraliteStatic') {
        results[fw.key] = {
          rawKB: 0.0,
          gzipKB: 0.0,
          hydrationMS: 0.0,
          ttiMS: 0.0
        }
        continue
      }

      const hydrationTimes = []
      const ttiTimes = []

      for (let i = 0; i < iterations; i++) {
        const page = await browser.newPage()
        const startNav = performance.now()

        await page.goto(`${serverUrl}/${fw.key}/index.html`)

        await page.waitForFunction(() => {
          return performance.getEntriesByName('hydration').length > 0
        })

        const hydDuration = await page.evaluate(() => {
          const entries = performance.getEntriesByName('hydration')
          return entries.length > 0 ? entries[0].duration : 0
        })
        hydrationTimes.push(+hydDuration.toFixed(2))

        await page.waitForSelector('#inc-qty')
        await page.click('#inc-qty')

        await page.waitForFunction(() => {
          const display = document.querySelector('#qty-display')
          return display && display.textContent.trim() === '2'
        })

        const tti = performance.now() - startNav
        ttiTimes.push(+tti.toFixed(2))

        await page.close()
      }

      results[fw.key] = {
        rawKB: bundleMetrics[fw.key].rawKB,
        gzipKB: bundleMetrics[fw.key].gzipKB,
        hydrationMS: calculateMedian(hydrationTimes),
        ttiMS: calculateMedian(ttiTimes)
      }
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
