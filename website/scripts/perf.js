import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'

const ROUTES = [
  {
    label: 'home',
    path: '/'
  },
  {
    label: 'docs',
    path: '/docs/guide/getting-started/'
  },
  {
    label: 'learn',
    path: '/learn/01-the-document/'
  },
  {
    label: 'blog',
    path: '/blog/coralite-v0-11-1/'
  }
]

const DESKTOP_ROUTE = '/'

const BUDGET = {
  mobileScore: 95,
  desktopScore: 99,
  lcpMs: 2500,
  cls: 0.1
}

/** @type {import('lighthouse').Flags} */
const MOBILE = {
  formFactor: 'mobile',
  screenEmulation: {
    mobile: true,
    width: 412,
    height: 823,
    deviceScaleFactor: 2.625,
    disabled: false
  },
  throttling: {
    rttMs: 150,
    throughputKbps: 1.6 * 1024,
    requestLatencyMs: 150 * 3.75,
    downloadThroughputKbps: 1.6 * 1024 * 0.9,
    uploadThroughputKbps: 750 * 0.9,
    cpuSlowdownMultiplier: 4
  }
}

/** @type {import('lighthouse').Flags} */
const DESKTOP = {
  formFactor: 'desktop',
  screenEmulation: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false
  },
  throttling: {
    rttMs: 40,
    throughputKbps: 10 * 1024,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
    cpuSlowdownMultiplier: 1
  }
}

/**
 * Polls a URL until it answers, so Lighthouse never races the static server.
 * @param {string} url - URL to probe.
 * @param {number} timeoutMs - Maximum wait in milliseconds.
 * @returns {Promise<void>} Resolves once the server answers.
 */
async function waitFor (url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(url)
      return
    } catch {
      await delay(150)
    }
  }
  throw new Error(`Timed out waiting for ${url}`)
}

/**
 * Serves the built site on a local port.
 * @returns {Promise<{ url: string, stop: () => void }>} Server URL and stop handle.
 */
async function startServer () {
  const port = Number(process.env.PERF_PORT || 3410)
  const child = spawn(process.execPath, [join(import.meta.dirname, 'serve-dist.js')], {
    env: {
      ...process.env,
      PORT: String(port)
    },
    stdio: 'ignore'
  })
  const url = `http://127.0.0.1:${port}`
  await waitFor(`${url}/`, 20_000)
  return {
    url,
    stop: () => child.kill()
  }
}

/**
 * Formats a Lighthouse audit as its display value.
 * @param {import('lighthouse').RunnerResult} result - Lighthouse runner result.
 * @param {string} id - Audit id.
 * @returns {string} Display value, or an em dash when absent.
 */
function metric (result, id) {
  const audit = result.lhr.audits[id]
  return audit?.displayValue || '—'
}

/**
 * Collects the audits that still report a meaningful opportunity.
 * @param {import('lighthouse').RunnerResult} result - Lighthouse runner result.
 * @returns {string[]} Human readable opportunity lines.
 */
function opportunities (result) {
  const lines = []
  for (const [id, entry] of Object.entries(result.lhr.audits)) {
    if (entry.score === 1 || entry.score === null) {
      continue
    }
    if (entry.details?.type !== 'opportunity') {
      continue
    }
    const savings = entry.displayValue ? ` (${entry.displayValue})` : ''
    lines.push(`${id}${savings}`)
  }
  return lines
}

/**
 * Audits one URL in one emulation mode.
 * @param {number} port - Chrome debugging port.
 * @param {string} url - Absolute URL to audit.
 * @param {'mobile' | 'desktop'} mode - Emulation mode.
 * @returns {Promise<{ score: number, fcp: string, lcp: string, tbt: string, cls: string, lcpMs: number, clsValue: number, issues: string[] }>} Selected metrics.
 */
async function runAudit (port, url, mode) {
  const result = await lighthouse(url, {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance'],
    ...(mode === 'mobile' ? MOBILE : DESKTOP)
  })
  if (!result) {
    throw new Error(`Lighthouse returned no result for ${url}`)
  }
  return {
    score: Math.round((result.lhr.categories.performance?.score || 0) * 100),
    fcp: metric(result, 'first-contentful-paint'),
    lcp: metric(result, 'largest-contentful-paint'),
    tbt: metric(result, 'total-blocking-time'),
    cls: metric(result, 'cumulative-layout-shift'),
    lcpMs: result.lhr.audits['largest-contentful-paint']?.numericValue || 0,
    clsValue: result.lhr.audits['cumulative-layout-shift']?.numericValue || 0,
    issues: opportunities(result)
  }
}

/**
 * Runs the mobile and desktop audits and reports the results.
 * @returns {Promise<void>} Resolves when the report is printed.
 */
async function main () {
  const assertMode = process.argv.includes('--assert')
  const external = process.env.PERF_URL
  const server = external ? null : await startServer()
  const base = (external || server?.url || '').replace(/\/$/, '')

  process.env.CHROME_PATH = process.env.CHROME_PATH || chromium.executablePath()
  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    logLevel: 'error'
  })

  const failures = []

  try {
    console.log(`Auditing ${base}\n`)
    for (const route of ROUTES) {
      const result = await runAudit(chrome.port, `${base}${route.path}`, 'mobile')
      failures.push(...check(route.path, 'mobile', result, BUDGET.mobileScore))
      print(row(route.path, 'mobile', result), result.issues)
    }

    const desktop = await runAudit(chrome.port, `${base}${DESKTOP_ROUTE}`, 'desktop')
    failures.push(...check(DESKTOP_ROUTE, 'desktop', desktop, BUDGET.desktopScore))
    print(row(DESKTOP_ROUTE, 'desktop', desktop), desktop.issues)
  } finally {
    chrome.kill()
    server?.stop()
  }

  if (assertMode && failures.length > 0) {
    console.error(`\nBudget failures:\n${failures.map(line => `  - ${line}`).join('\n')}`)
    process.exitCode = 1
    return
  }
  if (assertMode) {
    console.log('\nAll budgets held.')
  }
}

/**
 * Formats one result row.
 * @param {string} route - Audited path.
 * @param {string} mode - Emulation mode.
 * @param {{ score: number, fcp: string, lcp: string, tbt: string, cls: string }} result - Metrics.
 * @returns {string} Fixed width table row.
 */
function row (route, mode, result) {
  const cells = [route.padEnd(34), mode.padEnd(8), String(result.score).padStart(3), result.fcp.padStart(8), result.lcp.padStart(8), result.tbt.padStart(8), result.cls.padStart(7)]
  return cells.join('  ')
}

/**
 * Prints a row plus its remaining opportunities.
 * @param {string} line - Table row.
 * @param {string[]} issues - Opportunity lines.
 * @returns {void}
 */
function print (line, issues) {
  console.log(line)
  for (const issue of issues) {
    console.log(`${''.padEnd(36)}↳ ${issue}`)
  }
}

/**
 * Compares one result against the budget.
 * @param {string} route - Audited path.
 * @param {string} mode - Emulation mode.
 * @param {{ score: number, lcpMs: number, clsValue: number }} result - Metrics.
 * @param {number} scoreFloor - Minimum performance score.
 * @returns {string[]} Failure descriptions.
 */
function check (route, mode, result, scoreFloor) {
  const failures = []
  if (result.score < scoreFloor) {
    failures.push(`${route} ${mode}: score ${result.score} < ${scoreFloor}`)
  }
  if (result.lcpMs > BUDGET.lcpMs) {
    failures.push(`${route} ${mode}: LCP ${Math.round(result.lcpMs)} ms > ${BUDGET.lcpMs} ms`)
  }
  if (result.clsValue > BUDGET.cls) {
    failures.push(`${route} ${mode}: CLS ${result.clsValue.toFixed(3)} > ${BUDGET.cls}`)
  }
  return failures
}

console.log('route                               mode     score       FCP      LCP      TBT      CLS')
await main()
