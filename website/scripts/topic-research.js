#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  loadKeywordPlannerDirectory,
  loadSearchConsoleFile,
  loadSerpExportFile,
  loadSerpNotesFile,
  normalizeKeyword,
  parseKeywordPlannerText,
  recordsToCsv,
  writeSerpNotesFile,
  decodeTableBuffer
} from './lib/topic-research/csv.js'
import {
  buildCoverageReport,
  readContentInventory,
  readDocsInventory
} from './lib/topic-research/inventory.js'
import {
  generateSeedTopics,
  scoreTopics
} from './lib/topic-research/seed.js'
import {
  classifySerp,
  serpNote
} from './lib/topic-research/serp.js'
import { collectCommunityCounts } from './lib/topic-research/community.js'
import {
  collectTranscriptMentions,
  extractTranscriptCandidates,
  readTranscripts
} from './lib/topic-research/transcripts.js'
import { buildBacklogMarkdown } from './lib/topic-research/report.js'

const WEBSITE_ROOT = resolve(import.meta.dirname, '..')
const DATA_DIR = join(WEBSITE_ROOT, 'data/topics')
const KEYWORD_DIR = join(DATA_DIR, 'keyword-planner')
const TRANSCRIPT_DIR = join(DATA_DIR, 'transcripts')
const SEED_PATH = join(DATA_DIR, 'seed.json')
const BACKLOG_PATH = join(DATA_DIR, 'backlog.json')
const BACKLOG_CSV_PATH = join(DATA_DIR, 'backlog.csv')
const BACKLOG_MD_PATH = join(DATA_DIR, 'backlog.md')
const PUBLIC_BACKLOG_PATH = join(WEBSITE_ROOT, 'BLOG_BACKLOG.md')
const COMMUNITY_PATH = join(DATA_DIR, 'community.json')
const SERP_RESULTS_PATH = join(DATA_DIR, 'serp-results.json')
const SERP_NOTES_PATH = join(DATA_DIR, 'serp-notes.csv')
const SERP_EXPORT_PATH = join(DATA_DIR, 'serp-export.csv')
const TRANSCRIPT_CANDIDATES_PATH = join(DATA_DIR, 'transcripts-candidates.json')
const TRANSCRIPT_MENTIONS_PATH = join(DATA_DIR, 'transcriptMentions.json')
const KEYWORD_MERGED_PATH = join(DATA_DIR, 'keyword-planner.csv')
const SEARCH_CONSOLE_PATH = join(DATA_DIR, 'search-console.csv')

const HELP = `Coralite topic research

Usage:
  node scripts/topic-research.js <command> [options]

Commands:
  seed                  Write seed.json and Keyword Planner paste files
  merge:keywords        Merge Keyword Planner exports into keyword-planner.csv
  extract:transcripts   Extract candidate phrases from transcripts
  collect:transcripts   Count seed keyword mentions in transcripts
  collect:community     Collect Hacker News, Stack Exchange and GitHub counts
  collect:serp          Collect SERP results and score weakness/density
  reclassify            Recompute SERP notes from cached results
  audit:coverage        Compare seeds against the docs inventory
  score                 Score all topics and write the backlog
  report                Re-render the backlog Markdown from backlog.json

Options:
  --limit <n>           Maximum topics to process (default: 40, collect:serp: 25)
  --only <a,b>          Restrict to keywords containing any comma-separated fragment
  --provider <name>     SERP provider: auto, serpapi, file (default: auto)
  --env-file <path>     dotenvx-encrypted env file containing SERPAPI_API_KEY
  --refresh             Recollect data that already exists
  --dry-run             List SERP keywords without spending requests
  --gl <code>           SerpApi country code (default: us)
  --hl <lang>           SerpApi language code (default: en)
  -h, --help            Show this help
`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    limit: { type: 'string' },
    only: { type: 'string' },
    provider: {
      type: 'string',
      default: 'auto'
    },
    'env-file': { type: 'string' },
    refresh: {
      type: 'boolean',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      default: false
    },
    gl: {
      type: 'string',
      default: 'us'
    },
    hl: {
      type: 'string',
      default: 'en'
    },
    help: {
      type: 'boolean',
      shorthand: 'h',
      default: false
    }
  }
})

/**
 * Reads JSON, falling back to a default value.
 * @param {string} filePath - JSON path.
 * @param {any} fallback - Default value.
 * @returns {any} Parsed value or the fallback.
 */
function readJson (filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

/**
 * Writes formatted JSON, creating parent directories as needed.
 * @param {string} filePath - Destination path.
 * @param {unknown} value - JSON-serialisable value.
 */
function writeJson (filePath, value) {
  mkdirSync(resolve(filePath, '..'), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * Ensures a directory exists.
 * @param {string} directory - Directory path.
 */
function ensureDir (directory) {
  mkdirSync(directory, { recursive: true })
}

/**
 * Filters topics by the `--only` and `--limit` options.
 * @param {Array<object>} topics - Candidate topics.
 * @param {number} [defaultLimit] - Limit applied when `--limit` is absent.
 * @returns {Array<object>} Selected topics.
 */
function selectTopics (topics, defaultLimit) {
  const only = values.only
    ? values.only.split(',').map(fragment => normalizeKeyword(fragment)).filter(Boolean)
    : []
  const filtered = only.length === 0
    ? topics
    : topics.filter(topic => only.some(fragment => normalizeKeyword(topic.keyword).includes(fragment)))
  const limit = Number.parseInt(values.limit, 10) || defaultLimit || filtered.length
  return filtered.slice(0, limit)
}

/**
 * Loads seed topics from disk or generates them on first use.
 * @returns {Array<object>} Seed topics.
 */
function loadSeed () {
  const existing = readJson(SEED_PATH, null)
  if (Array.isArray(existing)) {
    return existing
  }
  return generateSeeds()
}

/**
 * Generates seed topics and writes the seed artefacts.
 * @returns {Array<object>} Generated seed topics.
 */
function generateSeeds () {
  ensureDir(DATA_DIR)
  const transcriptCandidates = readJson(TRANSCRIPT_CANDIDATES_PATH, [])
  const topics = generateSeedTopics({ transcriptCandidates })
  writeJson(SEED_PATH, topics)
  writeKeywordPlannerSeeds(topics)
  return topics
}

/**
 * Writes paste-friendly Keyword Planner seed files.
 * @param {Array<object>} topics - Seed topics.
 */
function writeKeywordPlannerSeeds (topics) {
  ensureDir(KEYWORD_DIR)
  const keywords = topics.map(topic => topic.keyword)
  writeFileSync(join(KEYWORD_DIR, 'seeds.txt'), `${keywords.join('\n')}\n`)

  const clusters = new Map()
  for (const topic of topics) {
    if (!clusters.has(topic.cluster)) {
      clusters.set(topic.cluster, [])
    }
    clusters.get(topic.cluster).push(topic.keyword)
  }
  const markdown = ['# Keyword Planner seed batches', '']
  for (const [cluster, entries] of clusters) {
    markdown.push(`## ${cluster}`, '', '```text', ...entries, '```', '')
  }
  writeFileSync(join(KEYWORD_DIR, 'seeds-by-cluster.md'), markdown.join('\n'))
}

/**
 * Loads Keyword Planner metrics from exports or the merged CSV.
 * @returns {Map<string, { volume: number, competition: string, source: string }>} Keyword metrics.
 */
function loadKeywordMetrics () {
  const directoryMetrics = loadKeywordPlannerDirectory(KEYWORD_DIR)
  if (directoryMetrics.size > 0) {
    return directoryMetrics
  }
  try {
    const text = decodeTableBuffer(readFileSync(KEYWORD_MERGED_PATH))
    const parsed = parseKeywordPlannerText(text, ',')
    return new Map([...parsed.entries()].map(([keyword, value]) => [keyword, {
      ...value,
      source: 'merged'
    }]))
  } catch {
    return new Map()
  }
}

/**
 * Builds SERP metrics for every seed topic from cached results and notes.
 * @param {Array<object>} topics - Seed topics.
 * @param {Record<string, object>} results - Cached SERP results by keyword.
 * @param {Map<string, object>} notes - SERP notes by keyword.
 * @returns {Map<string, { weakness: number, density: number, notes: string, source: string }>} SERP metrics.
 */
function buildSerpMetrics (topics, results, notes) {
  const metrics = new Map()
  for (const topic of topics) {
    const key = normalizeKeyword(topic.keyword)
    const result = results[topic.keyword] || results[key]
    const note = notes.get(key)
    if (result && Array.isArray(result.results)) {
      const classified = classifySerp(result.results)
      metrics.set(key, {
        weakness: note ? note.weakness : classified.weakness,
        density: classified.density,
        notes: note ? note.notes : serpNote(classified),
        source: note ? note.source : 'auto'
      })
    } else if (note) {
      metrics.set(key, {
        weakness: note.weakness,
        density: 0,
        notes: note.notes,
        source: note.source
      })
    }
  }
  return metrics
}

/**
 * Loads all scoring inputs and writes the backlog outputs.
 */
function writeBacklog () {
  const topics = loadSeed()
  const { docs, blog, content } = readContentInventory(WEBSITE_ROOT)
  const keywords = loadKeywordMetrics()
  const gsc = loadSearchConsoleFile(SEARCH_CONSOLE_PATH)
  const community = readJson(COMMUNITY_PATH, {})
  const serpResults = readJson(SERP_RESULTS_PATH, {})
  const serpNotes = loadSerpNotesFile(SERP_NOTES_PATH)
  const transcriptMentions = readJson(TRANSCRIPT_MENTIONS_PATH, {})

  const communityMap = new Map(Object.entries(community))
  const transcriptMap = new Map(Object.entries(transcriptMentions))
  const serpMap = buildSerpMetrics(topics, serpResults, serpNotes)

  const scored = scoreTopics({
    topics,
    docs: content,
    keywords,
    gsc,
    community: communityMap,
    serp: serpMap,
    transcriptMentions: transcriptMap
  })

  const payload = {
    generatedAt: new Date().toISOString(),
    settings: {
      keywordVolumes: keywords.size > 0,
      keywordRows: keywords.size,
      searchConsoleRows: gsc.size,
      communityRows: communityMap.size,
      serpRows: serpMap.size,
      transcriptRows: transcriptMap.size,
      docsPages: docs.length,
      blogPosts: blog.total,
      blogReleases: blog.releases
    },
    topics: scored
  }

  writeJson(BACKLOG_PATH, payload)
  writeFileSync(BACKLOG_CSV_PATH, recordsToCsv(scored.map(topic => ({
    rank: topic.rank,
    keyword: topic.keyword,
    cluster: topic.cluster,
    format: topic.format,
    action: topic.action,
    source: topic.source,
    score: topic.score,
    status: topic.status,
    strategic: topic.strategic,
    blockers: topic.blockers.join(';'),
    demand: topic.demand,
    volume: topic.demandSignals.volume,
    impressions: topic.demandSignals.impressions,
    community_mentions: topic.demandSignals.communityMentions,
    serp_density: topic.demandSignals.serpDensity,
    serp_weakness: topic.serpWeakness,
    transcript_mentions: topic.demandSignals.transcriptMentions,
    coverage: topic.coverage,
    coverage_kind: topic.coverageKind || '',
    coverage_page: topic.coveragePage || '',
    docs: topic.docs || ''
  })), [
    'rank',
    'keyword',
    'cluster',
    'format',
    'action',
    'source',
    'score',
    'status',
    'strategic',
    'blockers',
    'demand',
    'volume',
    'impressions',
    'community_mentions',
    'serp_density',
    'serp_weakness',
    'transcript_mentions',
    'coverage',
    'coverage_kind',
    'coverage_page',
    'docs'
  ]))

  const markdown = buildBacklogMarkdown(payload)
  writeFileSync(BACKLOG_MD_PATH, markdown)
  writeFileSync(PUBLIC_BACKLOG_PATH, markdown)

  console.log(`Scored ${scored.length} topics → ${BACKLOG_PATH}`)
  for (const topic of scored.slice(0, 10)) {
    console.log(`${String(topic.rank).padStart(2, ' ')}. ${topic.keyword} — ${topic.score} (${topic.status})`)
  }
}

/**
 * Resolves the SerpApi key from the environment or a dotenvx-encrypted file.
 * @param {string} [envFile] - Path to an encrypted env file.
 * @returns {string} API key, or an empty string when unavailable.
 */
function resolveSerpApiKey (envFile) {
  if (process.env.SERPAPI_API_KEY) {
    return process.env.SERPAPI_API_KEY
  }
  if (!envFile) {
    return ''
  }

  const resolvedPath = resolve(process.cwd(), envFile)
  if (!existsSync(resolvedPath)) {
    console.error(`Env file not found: ${resolvedPath}`)
    return ''
  }

  const binary = join(WEBSITE_ROOT, 'node_modules/.bin/dotenvx')
  if (!existsSync(binary)) {
    console.error('dotenvx is not installed. Run pnpm install in the website workspace.')
    return ''
  }

  try {
    return execFileSync(binary, ['get', 'SERPAPI_API_KEY', '-f', resolvedPath], {
      encoding: 'utf8',
      timeout: 20_000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    console.error('Could not read SERPAPI_API_KEY from the provided env file.')
    return ''
  }
}

/**
 * Fetches organic results for one keyword from SerpApi.
 * @param {string} keyword - Search query.
 * @param {{ key: string, gl: string, hl: string }} options - Request options.
 * @returns {Promise<Array<{ position: number, title: string, url: string, snippet: string }>>} Organic results.
 */
async function fetchSerpApiResults (keyword, options) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', keyword)
  url.searchParams.set('num', '10')
  url.searchParams.set('hl', options.hl)
  url.searchParams.set('gl', options.gl)
  url.searchParams.set('api_key', options.key)

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) {
    throw new Error(`SerpApi responded with ${response.status}`)
  }

  const data = await response.json()
  const organic = Array.isArray(data.organic_results) ? data.organic_results : []
  return organic.slice(0, 10).map((result, index) => ({
    position: Number(result.position) || index + 1,
    title: String(result.title || ''),
    url: String(result.link || ''),
    snippet: String(result.snippet || '')
  }))
}

/**
 * Waits between SerpApi requests.
 * @param {number} milliseconds - Delay in milliseconds.
 * @returns {Promise<void>} Resolves after the delay.
 */
function wait (milliseconds) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
}

/**
 * Recomputes SERP notes from cached results, preserving manual overrides.
 * @param {Record<string, object>} results - Cached SERP results.
 * @param {Map<string, object>} notes - Existing notes.
 * @returns {Map<string, object>} Updated notes.
 */
function recomputeSerpNotes (results, notes) {
  const updated = new Map(notes)
  for (const [keyword, result] of Object.entries(results)) {
    const key = normalizeKeyword(keyword)
    const existing = updated.get(key)
    if (existing && existing.source === 'manual') {
      continue
    }
    if (!Array.isArray(result.results)) {
      continue
    }
    const metrics = classifySerp(result.results)
    updated.set(key, {
      weakness: metrics.weakness,
      notes: serpNote(metrics),
      source: 'auto',
      checkedAt: result.checkedAt || new Date().toISOString()
    })
  }
  return updated
}

/**
 * Collects SERP results for selected topics and updates notes.
 */
async function collectSerp () {
  const topics = selectTopics(loadSeed(), 25)
  const existing = readJson(SERP_RESULTS_PATH, {})
  const pending = topics.filter(topic => values.refresh || !existing[topic.keyword])

  if (pending.length === 0) {
    console.log('All selected topics already have cached SERP results. Use --refresh to recollect.')
    return
  }

  if (values['dry-run']) {
    console.log(`Would query ${pending.length} keywords:`)
    for (const topic of pending) {
      console.log(`- ${topic.keyword}`)
    }
    return
  }

  let provider = values.provider
  if (provider === 'auto') {
    if (resolveSerpApiKey(values['env-file'])) {
      provider = 'serpapi'
    } else if (existsSync(SERP_EXPORT_PATH)) {
      provider = 'file'
    } else {
      provider = ''
    }
  }

  if (!provider) {
    console.error('No SERP provider available. Set SERPAPI_API_KEY, pass --env-file, or create serp-export.csv.')
    process.exitCode = 1
    return
  }

  if (provider === 'file') {
    const exported = loadSerpExportFile(SERP_EXPORT_PATH)
    let updated = 0
    for (const topic of pending) {
      const results = exported.get(normalizeKeyword(topic.keyword))
      if (!results) {
        console.warn(`No exported SERP rows for: ${topic.keyword}`)
        continue
      }
      existing[topic.keyword] = {
        provider: 'file',
        checkedAt: new Date().toISOString(),
        results
      }
      updated += 1
    }
    writeJson(SERP_RESULTS_PATH, existing)
    console.log(`Imported ${updated} keywords from serp-export.csv`)
  } else if (provider === 'serpapi') {
    const key = resolveSerpApiKey(values['env-file'])
    if (!key) {
      console.error('SERPAPI_API_KEY is not available. Pass --env-file or export the key.')
      process.exitCode = 1
      return
    }

    for (const topic of pending) {
      try {
        const results = await fetchSerpApiResults(topic.keyword, {
          key,
          gl: values.gl,
          hl: values.hl
        })
        existing[topic.keyword] = {
          provider: 'serpapi',
          checkedAt: new Date().toISOString(),
          results
        }
        writeJson(SERP_RESULTS_PATH, existing)
        console.log(`Collected: ${topic.keyword} (${results.length} results)`)
      } catch (error) {
        console.error(`SERP collection stopped at "${topic.keyword}": ${error.message}`)
        process.exitCode = 1
        break
      }
      await wait(800)
    }
  } else {
    console.error(`Unknown provider "${provider}". Use auto, serpapi or file.`)
    process.exitCode = 1
    return
  }

  const notes = recomputeSerpNotes(existing, loadSerpNotesFile(SERP_NOTES_PATH))
  ensureDir(DATA_DIR)
  writeSerpNotesFile(SERP_NOTES_PATH, notes)
  console.log(`Updated SERP notes → ${SERP_NOTES_PATH}`)
}

/**
 * Runs a topic research command.
 * @returns {Promise<void>} Resolves when the command completes.
 */
async function main () {
  const command = positionals[0] || 'score'

  if (values.help || command === 'help') {
    console.log(HELP)
    return
  }

  if (command === 'seed') {
    const topics = generateSeeds()
    console.log(`Wrote ${topics.length} seeds → ${SEED_PATH}`)
    console.log(`Keyword Planner batches → ${join(KEYWORD_DIR, 'seeds-by-cluster.md')}`)
    return
  }

  if (command === 'merge:keywords') {
    const metrics = loadKeywordPlannerDirectory(KEYWORD_DIR)
    if (metrics.size === 0) {
      console.error(`No Keyword Planner exports found in ${KEYWORD_DIR}.`)
      console.error('Download "Keyword stats" from Google Ads and drop the files there, then re-run.')
      process.exitCode = 1
      return
    }
    const rows = [...metrics.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([keyword, value]) => ({
        keyword,
        avg_monthly_searches: value.volume,
        competition: value.competition,
        source: value.source
      }))
    writeFileSync(KEYWORD_MERGED_PATH, recordsToCsv(rows, ['keyword', 'avg_monthly_searches', 'competition', 'source']))
    console.log(`Merged ${rows.length} keywords → ${KEYWORD_MERGED_PATH}`)
    return
  }

  if (command === 'extract:transcripts') {
    const transcripts = readTranscripts(TRANSCRIPT_DIR)
    if (transcripts.length === 0) {
      console.error(`No transcripts found in ${TRANSCRIPT_DIR}. Add .md or .txt files and re-run.`)
      process.exitCode = 1
      return
    }
    const candidates = extractTranscriptCandidates(transcripts)
    writeJson(TRANSCRIPT_CANDIDATES_PATH, candidates)
    console.log(`Extracted ${candidates.length} candidate phrases → ${TRANSCRIPT_CANDIDATES_PATH}`)
    for (const candidate of candidates.slice(0, 10)) {
      console.log(`- ${candidate.phrase} (${candidate.count})`)
    }
    console.log('Review the list, then re-run "seed" to add promoted phrases.')
    return
  }

  if (command === 'collect:transcripts') {
    const transcripts = readTranscripts(TRANSCRIPT_DIR)
    if (transcripts.length === 0) {
      console.error(`No transcripts found in ${TRANSCRIPT_DIR}.`)
      process.exitCode = 1
      return
    }
    const mentions = collectTranscriptMentions(loadSeed(), transcripts)
    writeJson(TRANSCRIPT_MENTIONS_PATH, mentions)
    console.log(`Wrote transcript mentions → ${TRANSCRIPT_MENTIONS_PATH}`)
    return
  }

  if (command === 'collect:community') {
    const topics = selectTopics(loadSeed(), 40)
    const existing = readJson(COMMUNITY_PATH, {})
    const pending = topics.filter(topic => values.refresh || !existing[topic.keyword])
    if (pending.length === 0) {
      console.log('All selected topics already have community counts. Use --refresh to recollect.')
      return
    }
    const counts = await collectCommunityCounts(pending, { log: message => console.log(message) })
    writeJson(COMMUNITY_PATH, {
      ...existing,
      ...counts
    })
    console.log(`Updated ${Object.keys(counts).length} community counts → ${COMMUNITY_PATH}`)
    return
  }

  if (command === 'collect:serp') {
    await collectSerp()
    return
  }

  if (command === 'reclassify') {
    const existing = readJson(SERP_RESULTS_PATH, {})
    if (Object.keys(existing).length === 0) {
      console.error(`No cached SERP results at ${SERP_RESULTS_PATH}. Run collect:serp first.`)
      process.exitCode = 1
      return
    }
    const notes = recomputeSerpNotes(existing, loadSerpNotesFile(SERP_NOTES_PATH))
    writeSerpNotesFile(SERP_NOTES_PATH, notes)
    console.log(`Reclassified ${notes.size} keywords → ${SERP_NOTES_PATH}`)
    return
  }

  if (command === 'audit:coverage') {
    const topics = loadSeed()
    const docs = readDocsInventory(WEBSITE_ROOT)
    const coverage = buildCoverageReport(topics, docs)
    writeJson(join(DATA_DIR, 'coverage.json'), coverage)
    const missing = coverage.filter(item => item.docs.level === 'none')
    console.log(`Scanned ${docs.length} docs pages; ${missing.length} topics have no docs coverage.`)
    for (const item of missing) {
      console.log(`- ${item.keyword}`)
    }
    return
  }

  if (command === 'score') {
    writeBacklog()
    return
  }

  if (command === 'report') {
    const payload = readJson(BACKLOG_PATH, null)
    if (!payload || !Array.isArray(payload.topics)) {
      console.error(`No backlog at ${BACKLOG_PATH}. Run "score" first.`)
      process.exitCode = 1
      return
    }
    const markdown = buildBacklogMarkdown(payload)
    writeFileSync(BACKLOG_MD_PATH, markdown)
    writeFileSync(PUBLIC_BACKLOG_PATH, markdown)
    console.log(`Wrote ${BACKLOG_MD_PATH} and ${PUBLIC_BACKLOG_PATH}`)
    return
  }

  console.error(`Unknown command "${command}".\n`)
  console.log(HELP)
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
