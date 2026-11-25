/** @type {Array<{ className: 'giant' | 'authority' | 'peer' | 'competitor' | 'directory' | 'forum', weight: number, patterns: string[] }>} */
const DOMAIN_CLASSES = [
  {
    className: 'giant',
    weight: 0,
    patterns: [
      'google.',
      'youtube.',
      'facebook.',
      'microsoft.',
      'apple.',
      'amazon.',
      'developer.mozilla.org',
      'react.dev',
      'nextjs.org',
      'astro.build',
      'svelte.dev',
      'vuejs.org',
      'angular.dev',
      'nuxt.com'
    ]
  },
  {
    className: 'authority',
    weight: 0.15,
    patterns: [
      'web.dev',
      'w3.org',
      'wikipedia.org',
      'developer.chrome.com',
      'developer.apple.com',
      'docs.github.com',
      'github.blog'
    ]
  },
  {
    className: 'peer',
    weight: 0.5,
    patterns: [
      'lit.dev',
      'stenciljs.com',
      '11ty.dev',
      'webc.js.org',
      'hugo.io',
      'gohugo.io',
      'gatsbyjs.com',
      'qwik.dev',
      'htmx.org',
      'solidjs.com',
      'deno.com',
      'bun.sh',
      'lume.io',
      'enhance.dev'
    ]
  },
  {
    className: 'competitor',
    weight: 0.7,
    patterns: [
      'staticgen.com',
      'jamstack.org',
      'ssg.io',
      'staticfinds.com',
      'stackshare.io',
      'alternativeto.net'
    ]
  },
  {
    className: 'directory',
    weight: 0.8,
    patterns: [
      'github.com',
      'npmjs.com',
      'dev.to',
      'medium.com',
      'producthunt.com',
      'news.ycombinator.com'
    ]
  },
  {
    className: 'forum',
    weight: 0.95,
    patterns: [
      'reddit.com',
      'stackoverflow.com',
      'stackexchange.com',
      'discourse.',
      'community.'
    ]
  }
]

const CLASS_WEIGHTS = {
  giant: 0,
  authority: 0.15,
  peer: 0.5,
  competitor: 0.7,
  directory: 0.8,
  forum: 0.95,
  vendor: 0.45,
  other: 0.55
}

const DENSITY_CLASSES = new Set(['peer', 'competitor', 'directory', 'forum', 'vendor', 'other'])

/**
 * Extracts a lowercase hostname from a URL.
 * @param {string} value - URL or hostname.
 * @returns {string} Hostname without `www.`.
 */
export function hostnameOf (value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return ''
  }
  try {
    const url = new URL(text.includes('://') ? text : `https://${text}`)
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return text.toLowerCase().replace(/^www\./, '')
  }
}

/**
 * Classifies a SERP result domain.
 * @param {string} value - URL or hostname.
 * @returns {'giant' | 'authority' | 'peer' | 'competitor' | 'directory' | 'forum' | 'vendor' | 'other'} Domain class.
 */
export function classifyDomain (value) {
  const host = hostnameOf(value)
  if (!host) {
    return 'other'
  }
  for (const entry of DOMAIN_CLASSES) {
    if (entry.patterns.some(pattern => host === pattern || host.endsWith(`.${pattern}`) || host.includes(pattern))) {
      return entry.className
    }
  }
  if (host.includes('docs.') || host.includes('documentation')) {
    return 'vendor'
  }
  return 'other'
}

/**
 * Scores SERP weakness and ecosystem density from organic results.
 * @param {Array<{ url: string, title?: string, snippet?: string }>} results - Organic results.
 * @returns {{ weakness: number, density: number, mean: number, counts: Record<string, number> }} SERP metrics.
 */
export function classifySerp (results) {
  const counts = {
    giant: 0,
    authority: 0,
    peer: 0,
    competitor: 0,
    directory: 0,
    forum: 0,
    vendor: 0,
    other: 0
  }
  const densityDomains = new Set()
  let weightedTotal = 0

  for (const result of results.slice(0, 10)) {
    const className = classifyDomain(result.url)
    counts[className] += 1
    weightedTotal += CLASS_WEIGHTS[className]
    if (DENSITY_CLASSES.has(className)) {
      densityDomains.add(hostnameOf(result.url))
    }
  }

  const resultCount = Math.min(results.length, 10)
  const mean = resultCount > 0 ? weightedTotal / resultCount : 0
  let weakness = Math.min(5, Math.max(1, Math.round(mean * 5)))

  const weakPages = counts.directory + counts.competitor + counts.peer
  if (weakPages >= 6) {
    weakness = Math.max(weakness, 4)
  }
  if (counts.giant >= 3 || counts.authority >= 4 || counts.vendor >= 8) {
    weakness = Math.min(weakness, 2)
  }

  return {
    weakness,
    density: Math.min(10, densityDomains.size),
    mean: Number(mean.toFixed(2)),
    counts
  }
}

/**
 * Builds a human-readable evidence note from SERP classification.
 * @param {{ weakness: number, density: number, mean: number, counts: Record<string, number> }} metrics - SERP metrics.
 * @returns {string} Evidence summary.
 */
export function serpNote (metrics) {
  const segments = Object.entries(metrics.counts)
    .filter(([, count]) => count > 0)
    .map(([className, count]) => `${className} ${count}`)
  return `${segments.join(' · ')} · mean ${metrics.mean} · density ${metrics.density}`
}
