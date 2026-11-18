#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ORIGIN = 'https://coralite.dev'
const root = resolve(import.meta.dirname, '..')
const sitemapFixture = join(root, 'scripts/fixtures/live-sitemap.xml')
const redirectsPath = join(root, 'public/_redirects')
const pagesDir = join(root, 'src/pages')

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const sitemapArg = args.find(arg => arg.startsWith('--sitemap='))

/**
 * Collects page files relative to the pages directory.
 * @param {string} dir - Directory to scan.
 * @param {string[]} [out] - Accumulator.
 * @returns {string[]} Relative page paths.
 */
function collectPages (dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') {
        continue
      }
      collectPages(path, out)
    } else if (entry.name.endsWith('.html')) {
      out.push(relative(pagesDir, path).split('\\').join('/'))
    }
  }
  return out
}

/**
 * Maps a page file to the clean URL the build produces.
 * @param {string} file - Page path relative to src/pages.
 * @returns {string} Route path.
 */
function routeFor (file) {
  const path = `/${file}`
  if (path.endsWith('/index.html')) {
    return path.slice(0, -'index.html'.length)
  }
  return path.replace(/\.html$/, '')
}

/**
 * Reads the redirect map from public/_redirects.
 * @returns {Map<string, { to: string, status: string }>} Redirect entries.
 */
function readRedirects () {
  const redirects = new Map()
  for (const line of readFileSync(redirectsPath, 'utf8').split('\n')) {
    const entry = line.trim()
    if (!entry || entry.startsWith('#')) {
      continue
    }
    const [from, to, status] = entry.split(/\s+/)
    redirects.set(from, {
      to,
      status
    })
  }
  return redirects
}

if (refresh) {
  const response = await fetch(`${ORIGIN}/sitemap.xml`)
  if (!response.ok) {
    console.error(`Failed to refresh sitemap: ${response.status}`)
    process.exit(1)
  }
  writeFileSync(sitemapFixture, await response.text())
  console.log(`Refreshed ${relative(root, sitemapFixture)}`)
}

let sitemap
if (sitemapArg) {
  const source = sitemapArg.slice('--sitemap='.length)
  sitemap = existsSync(source)
    ? readFileSync(source, 'utf8')
    : await (await fetch(source)).text()
} else {
  if (!existsSync(sitemapFixture)) {
    console.error(`Missing ${relative(root, sitemapFixture)}. Run with --refresh first.`)
    process.exit(1)
  }
  sitemap = readFileSync(sitemapFixture, 'utf8')
}

const legacyUrls = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), match => new URL(match[1]).pathname)
const routes = new Set(collectPages(pagesDir).map(routeFor))
const redirects = readRedirects()
const problems = []

for (const url of legacyUrls) {
  if (/\.[a-z0-9]+$/i.test(url) && !url.endsWith('.html')) {
    continue
  }
  if (routes.has(url) || redirects.has(url)) {
    continue
  }
  if (url.endsWith('.html') && routes.has(url.replace(/\.html$/, ''))) {
    continue
  }
  problems.push(`No redirect or route for legacy URL ${url}`)
}

/**
 * Follows redirects until a real route is reached.
 * @param {string} path - Redirect target.
 * @param {Set<string>} [seen] - Visited targets, used to detect cycles.
 * @returns {string|null} Final route, or null when the chain is broken.
 */
function resolveRoute (path, seen = new Set()) {
  if (routes.has(path)) {
    return path
  }
  const entry = redirects.get(path)
  if (!entry || !entry.to.startsWith('/') || seen.has(path)) {
    return null
  }
  seen.add(path)
  return resolveRoute(entry.to, seen)
}

for (const [from, { to, status }] of redirects) {
  if (!to.startsWith('/')) {
    continue
  }
  if (!resolveRoute(to)) {
    problems.push(`Redirect ${from} -> ${to} (${status}) targets a missing route`)
  }
}

if (problems.length) {
  console.error(`Redirect audit failed with ${problems.length} problem(s):`)
  for (const problem of problems) {
    console.error(`  - ${problem}`)
  }
  process.exit(1)
}

console.log(`Redirect audit passed: ${legacyUrls.length} legacy URLs, ${routes.size} routes, ${redirects.size} redirects`)
