import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'using',
  'what',
  'when',
  'where',
  'which',
  'with',
  'without',
  'your'
])

/**
 * Escapes characters that are significant in regular expressions.
 * @param {string} value - Raw text.
 * @returns {string} Escaped text.
 */
function escapeRegExp (value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Converts significant words of a phrase into lowercase tokens.
 * @param {string} value - Phrase.
 * @returns {string[]} Significant tokens.
 */
export function significantTokens (value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9@\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOPWORDS.has(token))
}

/**
 * Strips HTML tags from a fragment.
 * @param {string} value - HTML fragment.
 * @returns {string} Plain text.
 */
export function stripTags (value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ')
}

/**
 * Decodes the entities commonly used in page metadata.
 * @param {string} value - Encoded text.
 * @returns {string} Decoded text.
 */
export function decodeEntities (value) {
  return String(value ?? '')
    .replace(/&#(\d+);/g, (match, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Collects HTML files below a directory.
 * @param {string} directory - Directory to scan.
 * @param {string[]} [out] - Accumulator.
 * @returns {string[]} Absolute file paths.
 */
export function collectHtmlFiles (directory, out = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      collectHtmlFiles(path, out)
      continue
    }
    if (entry.name.endsWith('.html')) {
      out.push(path)
    }
  }
  return out
}

/**
 * Converts a page file path into its public route.
 * @param {string} pagesDirectory - Root pages directory.
 * @param {string} filePath - Page file path.
 * @returns {string} Route path with a leading slash.
 */
function routeFor (pagesDirectory, filePath) {
  const relativePath = relative(pagesDirectory, filePath).split('\\').join('/')
  if (relativePath === '404.html') {
    return '/404'
  }
  if (relativePath.endsWith('/index.html')) {
    return `/${relativePath.slice(0, -'index.html'.length)}`
  }
  return `/${relativePath.replace(/\.html$/, '')}/`
}

/**
 * Reads a page's metadata and headings.
 * @param {string} filePath - Page file path.
 * @returns {{ title: string, description: string, headings: string[] }} Page summary.
 */
function readPageSummary (filePath) {
  const html = readFileSync(filePath, 'utf8')
  const metaMatch = html.match(/<page-meta\b[^>]*>/i)
  const metaTag = metaMatch ? metaMatch[0] : ''
  const titleMatch = metaTag.match(/\btitle="([^"]*)"/i)
  const descriptionMatch = metaTag.match(/\bdescription="([^"]*)"/i)
  const headings = []
  const headingPattern = /<h[123]\b[^>]*>([\s\S]*?)<\/h[123]>/gi
  let match = headingPattern.exec(html)
  while (match) {
    headings.push(decodeEntities(stripTags(match[1])).replace(/\s+/g, ' ').trim())
    match = headingPattern.exec(html)
  }

  return {
    title: titleMatch ? decodeEntities(titleMatch[1]).trim() : '',
    description: descriptionMatch ? decodeEntities(descriptionMatch[1]).trim() : '',
    headings
  }
}

/**
 * Builds a content record for a page.
 * @param {string} websiteRoot - Website project root.
 * @param {string} filePath - Page file path.
 * @param {'docs' | 'blog'} kind - Content kind.
 * @returns {{ route: string, file: string, title: string, description: string, headings: string[], text: string, kind: 'docs' | 'blog' }} Content record.
 */
function contentRecord (websiteRoot, filePath, kind) {
  const summary = readPageSummary(filePath)
  const pagesDirectory = join(websiteRoot, 'src/pages')
  return {
    route: routeFor(pagesDirectory, filePath),
    file: relative(websiteRoot, filePath).split('\\').join('/'),
    title: summary.title,
    description: summary.description,
    headings: summary.headings,
    text: [summary.title, summary.description, ...summary.headings].join(' ').toLowerCase(),
    kind
  }
}

/**
 * Builds an inventory of documentation pages.
 * @param {string} websiteRoot - Website project root.
 * @returns {Array<{ route: string, file: string, title: string, description: string, headings: string[], text: string, kind: 'docs' | 'blog' }>} Docs pages.
 */
export function readDocsInventory (websiteRoot) {
  const pagesDirectory = join(websiteRoot, 'src/pages')
  const directories = ['docs', 'reference', 'learn'].map(directory => join(pagesDirectory, directory))
  const files = directories.flatMap(directory => collectHtmlFiles(directory))
  return files
    .map(filePath => contentRecord(websiteRoot, filePath, 'docs'))
    .sort((left, right) => left.route.localeCompare(right.route))
}

/**
 * Builds an inventory of blog posts, separating releases from editorial posts.
 * @param {string} websiteRoot - Website project root.
 * @returns {{ total: number, releases: number, editorial: Array<{ slug: string, title: string }>, items: Array<object> }} Blog summary.
 */
export function readBlogInventory (websiteRoot) {
  const pagesDirectory = join(websiteRoot, 'src/pages')
  const blogDirectory = join(pagesDirectory, 'blog')
  const files = readdirSync(blogDirectory).filter(file => file.endsWith('.html') && file !== 'index.html')
  const editorial = []
  const items = []

  for (const file of files) {
    if (/^coralite-v/i.test(file)) {
      continue
    }
    const record = contentRecord(websiteRoot, join(blogDirectory, file), 'blog')
    items.push(record)
    editorial.push({
      slug: file.replace(/\.html$/, ''),
      title: record.title || record.headings[0] || file
    })
  }

  return {
    total: files.length,
    releases: files.filter(file => /^coralite-v/i.test(file)).length,
    editorial,
    items
  }
}

/**
 * Combines docs and editorial blog posts into a single coverage corpus.
 * @param {string} websiteRoot - Website project root.
 * @returns {{ docs: Array<object>, blog: object, content: Array<object> }} Content inventory.
 */
export function readContentInventory (websiteRoot) {
  const docs = readDocsInventory(websiteRoot)
  const blog = readBlogInventory(websiteRoot)
  return {
    docs,
    blog,
    content: [...docs, ...blog.items]
  }
}

/**
 * Measures how well the docs cover a topic.
 * @param {{ keyword: string, docs?: string | null }} topic - Seed topic.
 * @param {Array<{ route: string, file: string, title: string, description: string, headings: string[], text: string, kind?: 'docs' | 'blog' }>} sources - Docs and blog inventory.
 * @returns {{ level: 'canonical' | 'partial' | 'none', page: string | null, kind: 'docs' | 'blog' | null, matched: number, required: number }} Coverage result.
 */
export function matchDocsCoverage (topic, sources) {
  if (topic.docs) {
    const targetRoute = String(topic.docs).replace(/\/+$/, '')
    const page = sources.find(item => item.route.replace(/\/+$/, '') === targetRoute || item.file === topic.docs)
    if (page) {
      return {
        level: 'canonical',
        page: page.route,
        kind: page.kind || 'docs',
        matched: 0,
        required: 0
      }
    }
  }

  const tokens = significantTokens(topic.keyword)
  if (tokens.length === 0) {
    return {
      level: 'none',
      page: null,
      kind: null,
      matched: 0,
      required: 0
    }
  }

  const required = Math.max(2, Math.ceil(tokens.length * 0.5))
  /** @type {{ level: 'canonical' | 'partial' | 'none', page: string | null, kind: 'docs' | 'blog' | null, matched: number, required: number }} */
  let best = {
    level: 'none',
    page: null,
    kind: null,
    matched: 0,
    required
  }

  for (const page of sources) {
    const haystack = `${page.text} ${page.title} ${page.description}`.toLowerCase()
    const matched = tokens.filter(token => new RegExp(`\\b${escapeRegExp(token)}\\b`).test(haystack)).length
    if (matched > best.matched) {
      best = {
        level: matched >= required ? 'partial' : 'none',
        page: matched >= required ? page.route : null,
        kind: matched >= required ? (page.kind || 'docs') : null,
        matched,
        required
      }
    }
  }

  return best
}

/**
 * Builds coverage records for every seed topic.
 * @param {Array<object>} topics - Seed topics.
 * @param {Array<object>} docs - Docs inventory.
 * @returns {Array<object>} Coverage records.
 */
export function buildCoverageReport (topics, docs) {
  return topics.map((topic) => {
    const coverage = matchDocsCoverage(topic, docs)
    return {
      keyword: topic.keyword,
      cluster: topic.cluster,
      docs: coverage,
      coverageKind: coverage.kind,
      evidence: topic.evidence || [],
      action: topic.action || 'docs+post'
    }
  })
}
