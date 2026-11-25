import { execFileSync } from 'node:child_process'

const REQUEST_TIMEOUT_MS = 12_000
const REQUEST_DELAY_MS = 300

/**
 * Waits before the next outbound request.
 * @param {number} milliseconds - Delay in milliseconds.
 * @returns {Promise<void>} Resolves after the delay.
 */
function wait (milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

/**
 * Fetches JSON with a hard timeout.
 * @param {string} url - Request URL.
 * @returns {Promise<object | null>} Parsed JSON, or null on failure.
 */
async function fetchJson (url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Counts Hacker News stories matching a query.
 * @param {string} query - Search query.
 * @returns {Promise<number>} Matching story count.
 */
export async function hackerNewsCount (query) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=0`
  const data = await fetchJson(url)
  return Number(data?.nbHits) || 0
}

/**
 * Counts Stack Overflow questions matching a query.
 * @param {string} query - Search query.
 * @returns {Promise<number>} Matching question count.
 */
export async function stackExchangeCount (query) {
  const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=1&filter=total`
  const data = await fetchJson(url)
  return Number(data?.total) || 0
}

/**
 * Counts GitHub issues and pull requests matching a query using the GitHub CLI.
 * @param {string} query - Search query.
 * @returns {number} Matching issue count, or zero when `gh` is unavailable.
 */
export function githubCount (query) {
  try {
    const output = execFileSync('gh', [
      'api',
      `search/issues?q=${encodeURIComponent(query)}&per_page=1`,
      '--jq',
      '.total_count'
    ], {
      encoding: 'utf8',
      timeout: REQUEST_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    return Number.parseInt(output.trim(), 10) || 0
  } catch {
    return 0
  }
}

/**
 * Collects community mention counts for a list of topics.
 * @param {Array<{ keyword: string, communityQuery?: string }>} topics - Topics to query.
 * @param {{ log?: (message: string) => void }} [options={}] - Collection options.
 * @returns {Promise<Record<string, { count: number, query: string, sources: Record<string, number> }>>} Counts by keyword.
 */
export async function collectCommunityCounts (topics, options = {}) {
  const log = options.log || (() => {
  })
  /** @type {Record<string, { count: number, query: string, sources: Record<string, number> }>} */
  const results = {}

  for (const topic of topics) {
    const query = topic.communityQuery || topic.keyword
    const hackerNews = await hackerNewsCount(query)
    await wait(REQUEST_DELAY_MS)
    const stackExchange = await stackExchangeCount(query)
    const github = githubCount(query)
    let githubContribution = 0
    if (github >= 100) {
      githubContribution = 3
    } else if (github >= 10) {
      githubContribution = 2
    } else if (github > 0) {
      githubContribution = 1
    }
    const count = hackerNews + stackExchange + githubContribution
    results[topic.keyword] = {
      count,
      query,
      sources: {
        hackerNews,
        stackExchange,
        github,
        githubContribution
      }
    }
    log(`${topic.keyword}: ${count} (HN ${hackerNews}, SE ${stackExchange}, GH ${github} → ${githubContribution})`)
    await wait(REQUEST_DELAY_MS)
  }

  return results
}
