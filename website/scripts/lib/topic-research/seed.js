import { normalizeKeyword } from './csv.js'
import { matchDocsCoverage, significantTokens } from './inventory.js'

const PEER_DOMAINS = ['astro', 'eleventy', 'lit', 'stencil', 'hugo', 'nextjs']

const STRATEGIC_CLUSTERS = new Set([
  'light-dom',
  'validation',
  'performance',
  'migrations',
  'ai-workflow'
])

const MANUAL_TOPICS = [
  {
    keyword: 'web components without shadow dom',
    cluster: 'light-dom',
    intent: 'informational',
    communityQuery: 'web components light dom',
    docs: '/docs/concepts/styling/',
    evidence: ['lib/server/utils/style.js', 'docs/concepts/styling.html'],
    action: 'docs+post',
    format: 'explainer'
  },
  {
    keyword: 'css @scope vs shadow dom',
    cluster: 'light-dom',
    intent: 'informational',
    communityQuery: 'css @scope shadow dom',
    docs: '/docs/concepts/styling/',
    evidence: ['formatComponentCss dual scope', 'lib/server/utils/style.js'],
    action: 'docs+post',
    format: 'head-to-head'
  },
  {
    keyword: 'zero javascript web components',
    cluster: 'light-dom',
    intent: 'informational',
    communityQuery: 'zero javascript web components',
    docs: '/docs/guide/components/',
    evidence: ['zero-JS static contract', 'build output without client lifecycle'],
    action: 'docs+post',
    format: 'explainer'
  },
  {
    keyword: 'light dom slots vs shadow dom slots',
    cluster: 'light-dom',
    intent: 'informational',
    communityQuery: 'light dom slots',
    docs: '/reference/slots/',
    evidence: ['::slotted transform', 'slot projection tests'],
    action: 'docs+post',
    format: 'explainer'
  },
  {
    keyword: 'ssr web components without react',
    cluster: 'ssr',
    intent: 'informational',
    communityQuery: 'ssr web components',
    docs: '/docs/guide/ssr/',
    evidence: ['server-side DOM', 'docs/guide/ssr.html'],
    action: 'docs+post',
    format: 'explainer'
  },
  {
    keyword: 'hydration free static html',
    cluster: 'ssr',
    intent: 'informational',
    communityQuery: 'hydration free static site',
    docs: '/docs/guide/e2e-testing/',
    evidence: ['hydration readiness hook', 'zero-JS static components'],
    action: 'docs-first',
    format: 'explainer'
  },
  {
    keyword: 'static site i18n at build time',
    cluster: 'recipes',
    intent: 'informational',
    communityQuery: 'static site i18n build time',
    docs: '/docs/guide/i18n/',
    evidence: ['docs/guide/i18n.html', 'i18n page tests'],
    action: 'docs+post',
    format: 'how-to'
  },
  {
    keyword: 'content security policy web components',
    cluster: 'recipes',
    intent: 'informational',
    communityQuery: 'content security policy web components',
    docs: '/docs/guide/csp/',
    evidence: ['docs/guide/csp.html', 'csp hash injection'],
    action: 'docs+post',
    format: 'how-to'
  },
  {
    keyword: 'form associated web components light dom',
    cluster: 'recipes',
    intent: 'informational',
    communityQuery: 'form associated custom elements',
    docs: '/reference/form-control/',
    evidence: ['formControl export', 'component contract tests'],
    action: 'docs+post',
    format: 'how-to'
  },
  {
    keyword: 'build time data fetching web components',
    cluster: 'recipes',
    intent: 'informational',
    communityQuery: 'build time data fetching',
    docs: '/docs/guide/ssr/',
    evidence: ['server() execution pipeline', 'docs/guide/ssr.html'],
    action: 'docs+post',
    format: 'how-to'
  },
  {
    keyword: 'spa router without react',
    cluster: 'recipes',
    intent: 'informational',
    communityQuery: 'spa router without react',
    docs: '/docs/guide/spa-router/',
    evidence: ['router plugin', 'docs/reference/plugins/router.html'],
    action: 'docs+post',
    format: 'how-to'
  },
  {
    keyword: 'deploy static site nginx cloudflare',
    cluster: 'recipes',
    intent: 'informational',
    communityQuery: 'deploy static site nginx',
    docs: null,
    evidence: ['euroloom deploy script', 'coralite build output'],
    action: 'docs-first',
    format: 'how-to'
  },
  {
    keyword: 'coralite cli cookbook',
    cluster: 'recipes',
    intent: 'informational',
    communityQuery: 'static site cli build check',
    docs: '/reference/cli/',
    evidence: ['CLI commands', 'docs/guide/testing.html'],
    action: 'docs+post',
    format: 'qa'
  },
  {
    keyword: 'build time validation web components',
    cluster: 'validation',
    intent: 'informational',
    communityQuery: 'build time validation web components',
    docs: '/docs/guide/validation/',
    evidence: ['validator passes', '53 diagnostics'],
    action: 'docs+post',
    format: 'data'
  },
  {
    keyword: 'coralite diagnostics error codes',
    cluster: 'validation',
    intent: 'informational',
    communityQuery: 'build time error diagnostics',
    docs: '/reference/diagnostics/',
    evidence: ['diagnostic catalog', 'llms/diagnostics.md'],
    action: 'docs-first',
    format: 'qa'
  },
  {
    keyword: 'coralite vs astro',
    cluster: 'comparisons',
    intent: 'informational',
    communityQuery: 'astro vs eleventy',
    docs: null,
    evidence: ['external benchmark harness', 'benchmarks/README.md'],
    action: 'blog-only',
    format: 'head-to-head'
  },
  {
    keyword: 'coralite vs eleventy',
    cluster: 'comparisons',
    intent: 'informational',
    communityQuery: 'eleventy vs hugo',
    docs: null,
    evidence: ['lumeland benchmark adapter', 'benchmarks/README.md'],
    action: 'blog-only',
    format: 'head-to-head'
  },
  {
    keyword: 'static site generator benchmark',
    cluster: 'performance',
    intent: 'informational',
    communityQuery: 'static site generator benchmark',
    docs: null,
    evidence: ['benchmarks/results', 'internal hydration suites'],
    action: 'blog-only',
    format: 'data'
  },
  {
    keyword: 'static site generator build time comparison',
    cluster: 'performance',
    intent: 'informational',
    communityQuery: 'static site generator build time',
    docs: null,
    evidence: ['lumeland benchmark adapter', 'benchmarks/results/external'],
    action: 'blog-only',
    format: 'data'
  },
  {
    keyword: 'replace react islands with web components',
    cluster: 'migrations',
    intent: 'informational',
    communityQuery: 'react islands web components',
    docs: null,
    evidence: ['hydration payload benchmarks', 'zero-JS static components'],
    action: 'blog-only',
    format: 'migration'
  },
  {
    keyword: 'coralite v1 migration named exports',
    cluster: 'migrations',
    intent: 'informational',
    communityQuery: 'coralite v1 migration',
    docs: '/docs/guide/authoring/',
    evidence: ['named export authoring contract', 'coralite fix codemods'],
    action: 'docs+post',
    format: 'migration'
  },
  {
    keyword: 'when not to use a custom element',
    cluster: 'trust',
    intent: 'informational',
    communityQuery: 'when to use custom elements',
    docs: '/docs/reference/non-features/',
    evidence: ['docs/reference/non-features.html'],
    action: 'docs+post',
    format: 'decision'
  },
  {
    keyword: 'coralite production readiness',
    cluster: 'trust',
    intent: 'commercial',
    communityQuery: 'static site generator production ready',
    docs: null,
    evidence: ['release history', 'cross-platform smoke tests'],
    action: 'blog-only',
    format: 'decision'
  },
  {
    keyword: 'ai agent build time guardrails',
    cluster: 'ai-workflow',
    intent: 'informational',
    communityQuery: 'ai coding agent guardrails',
    docs: null,
    evidence: ['AGENTS invariants', 'validator contract tests'],
    action: 'blog-only',
    format: 'essay'
  },
  {
    keyword: 'spec driven ai development',
    cluster: 'ai-workflow',
    intent: 'informational',
    communityQuery: 'spec driven development',
    docs: null,
    evidence: ['Corallum multi-agent pipeline', 'typed artifacts'],
    action: 'blog-only',
    format: 'essay'
  }
]

/**
 * Adds a topic to the seed map when it is new.
 * @param {Map<string, object>} byKey - Keyword map.
 * @param {object} topic - Candidate topic.
 */
function addTopic (byKey, topic) {
  const key = normalizeKeyword(topic.keyword)
  if (!key || byKey.has(key)) {
    return
  }
  byKey.set(key, {
    keyword: String(topic.keyword).trim(),
    cluster: topic.cluster || 'generated',
    intent: topic.intent || 'informational',
    communityQuery: topic.communityQuery || topic.keyword,
    docs: topic.docs || null,
    evidence: topic.evidence || [],
    action: topic.action || 'blog-only',
    format: topic.format || 'explainer',
    source: topic.source || 'manual'
  })
}

/**
 * Generates seed topics from the curated catalog, transcript candidates and peer comparisons.
 * @param {{ transcriptCandidates?: Array<{ phrase: string, count: number }> }} [options={}] - Seed options.
 * @returns {Array<object>} Seed topics.
 */
export function generateSeedTopics (options = {}) {
  const byKey = new Map()
  for (const topic of MANUAL_TOPICS) {
    addTopic(byKey, topic)
  }

  for (const peer of PEER_DOMAINS) {
    addTopic(byKey, {
      keyword: `${peer} alternative`,
      cluster: 'comparisons',
      intent: 'commercial',
      communityQuery: `${peer} alternative`,
      docs: null,
      evidence: ['external benchmark harness', 'benchmarks/README.md'],
      action: 'blog-only',
      format: 'head-to-head',
      source: 'generated'
    })
    addTopic(byKey, {
      keyword: `coralite vs ${peer}`,
      cluster: 'comparisons',
      intent: 'informational',
      communityQuery: `${peer} alternative`,
      docs: null,
      evidence: ['external benchmark harness', 'benchmarks/README.md'],
      action: 'blog-only',
      format: 'head-to-head',
      source: 'generated'
    })
  }

  for (const candidate of options.transcriptCandidates || []) {
    const keyword = String(candidate.phrase || '').trim()
    if (!keyword || significantTokens(keyword).length < 2) {
      continue
    }
    addTopic(byKey, {
      keyword,
      cluster: 'transcript',
      intent: 'informational',
      communityQuery: keyword,
      docs: null,
      evidence: [],
      action: 'blog-only',
      format: 'explainer',
      source: 'transcript'
    })
  }

  return [...byKey.values()].sort((left, right) => left.keyword.localeCompare(right.keyword))
}

/**
 * Buckets a numeric value into a 0-5 score.
 * @param {number} value - Observed value.
 * @param {number[]} thresholds - Upper bounds for buckets 1-4.
 * @returns {number} Score from 0 to 5.
 */
export function bucket (value, thresholds) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  for (let index = 0; index < thresholds.length; index++) {
    if (value < thresholds[index]) {
      return index + 1
    }
  }
  return 5
}

/**
 * Converts search intent into a 1-5 score.
 * @param {string} intent - Intent label.
 * @returns {number} Intent score.
 */
export function intentScore (intent) {
  const scores = {
    informational: 3,
    commercial: 5,
    transactional: 4,
    navigational: 1
  }
  return scores[String(intent || '').toLowerCase()] || 3
}

/**
 * Converts docs coverage into a 1-5 score.
 * @param {'canonical' | 'partial' | 'none'} level - Coverage level.
 * @returns {number} Coverage score.
 */
export function coverageScore (level) {
  if (level === 'canonical') {
    return 5
  }
  if (level === 'partial') {
    return 3
  }
  return 1
}

/**
 * Converts evidence references into a 1-5 answerability score.
 * @param {string[]} evidence - Evidence references.
 * @returns {number} Answerability score.
 */
export function answerabilityScore (evidence) {
  if (!evidence || evidence.length === 0) {
    return 2
  }
  if (evidence.length === 1) {
    return 4
  }
  return 5
}

/**
 * Scores seed topics against demand, SERP, docs and transcript signals.
 * @param {object} input - Scoring input.
 * @param {Array<object>} input.topics - Seed topics.
 * @param {Array<object>} input.docs - Docs inventory.
 * @param {Map<string, { volume: number, source?: string }>} [input.keywords] - Keyword volumes.
 * @param {Map<string, { impressions: number, clicks?: number, position?: number }>} [input.gsc] - Search Console metrics.
 * @param {Map<string, { count: number, sources?: object }>} [input.community] - Community mentions.
 * @param {Map<string, { weakness: number, density: number, notes?: string, source?: string }>} [input.serp] - SERP metrics.
 * @param {Map<string, number>} [input.transcriptMentions] - Transcript mention counts.
 * @returns {Array<object>} Scored topics, sorted by score.
 */
export function scoreTopics (input) {
  const {
    topics,
    docs,
    keywords = new Map(),
    gsc = new Map(),
    community = new Map(),
    serp = new Map(),
    transcriptMentions = new Map()
  } = input

  const scored = topics.map((topic) => {
    const key = normalizeKeyword(topic.keyword)
    const coverage = matchDocsCoverage(topic, docs)
    const keywordMetrics = keywords.get(key) || {
      volume: 0,
      source: ''
    }
    const searchMetrics = gsc.get(key) || { impressions: 0 }
    const communityMetrics = community.get(key) || { count: 0 }
    const serpMetrics = serp.get(key) || {
      weakness: 0,
      density: 0
    }
    const mentions = Number(communityMetrics.count) || 0
    const transcriptCount = Number(transcriptMentions.get(key)) || 0

    const volumeScore = bucket(Number(keywordMetrics.volume) || 0, [10, 50, 200, 1000])
    const gscScore = bucket(Number(searchMetrics.impressions) || 0, [100, 500, 2000, 10000])
    const communityScore = bucket(mentions, [1, 2, 4, 7, 11])
    const densityScore = bucket(Number(serpMetrics.density) || 0, [1, 3, 5, 8])

    const demandParts = []
    if (keywordMetrics.volume > 0) {
      demandParts.push({
        score: volumeScore,
        weight: 0.4
      })
    }
    if (searchMetrics.impressions > 0) {
      demandParts.push({
        score: gscScore,
        weight: 0.4
      })
    }
    if (mentions > 0) {
      demandParts.push({
        score: communityScore,
        weight: 0.25
      })
    }
    if (serpMetrics.density > 0) {
      demandParts.push({
        score: densityScore,
        weight: 0.25
      })
    }

    const demandWeight = demandParts.reduce((total, part) => total + part.weight, 0)
    const demand = demandWeight > 0
      ? demandParts.reduce((total, part) => total + (part.score * part.weight), 0) / demandWeight
      : 1

    const intent = intentScore(topic.intent)
    const weakness = Math.min(5, Math.max(1, Number(serpMetrics.weakness) || 3))
    const coverageValue = coverageScore(coverage.level)
    const answerability = answerabilityScore(topic.evidence)
    const editorialMultiplier = 1 + (Math.min(transcriptCount, 10) * 0.02)
    const hasDemand = demandParts.length > 0

    const strategic = topic.source === 'manual' ||
      topic.source === 'transcript' ||
      STRATEGIC_CLUSTERS.has(topic.cluster)
    const competitiveSerp = weakness <= 2
    const blockers = []
    if (intent <= 1 || (competitiveSerp && !strategic)) {
      blockers.push('weak-intent-or-serp')
    }
    if (competitiveSerp && strategic) {
      blockers.push('competitive-serp')
    }
    if (topic.action !== 'blog-only' && coverage.kind !== 'docs') {
      blockers.push('needs-docs')
    }
    if (!topic.evidence || topic.evidence.length === 0) {
      blockers.push('needs-evidence')
    }
    if (!hasDemand) {
      blockers.push('needs-data')
    }

    let status = 'ready'
    if (blockers.includes('weak-intent-or-serp')) {
      status = 'skip'
    } else if (blockers.includes('needs-docs')) {
      status = 'needs-docs'
    } else if (blockers.includes('needs-evidence')) {
      status = 'needs-evidence'
    } else if (blockers.includes('needs-data')) {
      status = 'needs-data'
    }

    const rawScore = (demand / 5) * (intent / 5) * (weakness / 5) * (coverageValue / 5) * (answerability / 5) * 100
    const score = Math.min(100, Math.round(rawScore * editorialMultiplier))

    return {
      keyword: topic.keyword,
      cluster: topic.cluster,
      intent: topic.intent,
      format: topic.format,
      action: topic.action,
      source: topic.source || 'manual',
      demand: Number(demand.toFixed(2)),
      demandSignals: {
        volume: Number(keywordMetrics.volume) || 0,
        volumeSource: keywordMetrics.source || '',
        impressions: Number(searchMetrics.impressions) || 0,
        communityMentions: mentions,
        communitySources: communityMetrics.sources || {},
        serpDensity: Number(serpMetrics.density) || 0,
        transcriptMentions: transcriptCount
      },
      coverage: coverage.level,
      coveragePage: coverage.page,
      coverageKind: coverage.kind,
      evidence: topic.evidence || [],
      serpWeakness: weakness,
      serpNotes: serpMetrics.notes || '',
      answerability,
      editorialMultiplier: Number(editorialMultiplier.toFixed(2)),
      score,
      status,
      blockers,
      strategic,
      docs: topic.docs || null
    }
  })

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    if (right.demand !== left.demand) {
      return right.demand - left.demand
    }
    return left.keyword.localeCompare(right.keyword)
  })

  return scored.map((topic, index) => ({
    ...topic,
    rank: index + 1
  }))
}
