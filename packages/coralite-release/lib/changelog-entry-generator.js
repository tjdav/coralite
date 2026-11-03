import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import semver from 'semver'

/**
 * Formats an ISO date or timestamp into a readable date string (e.g., "Nov 2, 2026").
 * @param {string|Date} dateInput - Input date string or Date instance
 * @returns {string} Formatted human-readable date
 */
export function formatChangelogDate (dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput || Date.now())
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getUTCMonth()]
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  return `${month} ${day}, ${year}`
}

/**
 * Converts markdown text into Coralite-compatible semantic HTML for changelog display.
 * @param {string} markdown - Raw markdown text
 * @returns {string} Converted HTML string
 */
export function convertMarkdownToTimelineHtml (markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return ''
  }

  const lines = markdown.split(/\r?\n/)
  const htmlParts = []
  let inCodeBlock = false
  let codeLanguage = ''
  let codeLines = []
  let inList = false

  const closeListIfNeeded = () => {
    if (inList) {
      htmlParts.push('</ul>')
      inList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // Fenced code blocks
    if (trimmed.startsWith('```')) {
      closeListIfNeeded()
      if (inCodeBlock) {
        const codeContent = codeLines.join('\n')
        const escaped = codeContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        const langAttr = codeLanguage ? ` language="${codeLanguage}"` : ''
        htmlParts.push(`<coralite-code-highlight${langAttr}>\n${escaped}\n</coralite-code-highlight>`)
        inCodeBlock = false
        codeLanguage = ''
        codeLines = []
      } else {
        inCodeBlock = true
        codeLanguage = trimmed.slice(3).trim()
        codeLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(rawLine)
      continue
    }

    // Skip horizontal rules
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      closeListIfNeeded()
      continue
    }

    // Empty lines
    if (trimmed === '') {
      closeListIfNeeded()
      continue
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      closeListIfNeeded()
      const headingText = trimmed.slice(5).trim()
      htmlParts.push(`<coralite-heading level="4" text="${headingText}"></coralite-heading>`)
      continue
    }

    if (trimmed.startsWith('### ')) {
      closeListIfNeeded()
      const headingText = trimmed.slice(4).trim()
      htmlParts.push(`<coralite-heading level="3" text="${headingText}"></coralite-heading>`)
      continue
    }

    if (trimmed.startsWith('## ')) {
      closeListIfNeeded()
      const headingText = trimmed.slice(3).trim()
      htmlParts.push(`<coralite-heading level="2" text="${headingText}"></coralite-heading>`)
      continue
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        htmlParts.push('<ul>')
        inList = true
      }
      const itemText = inlineFormat(trimmed.slice(2).trim())
      htmlParts.push(`  <li>${itemText}</li>`)
      continue
    }

    // Standard paragraph
    closeListIfNeeded()
    const paragraphText = inlineFormat(trimmed)
    htmlParts.push(`<p>${paragraphText}</p>`)
  }

  closeListIfNeeded()
  return htmlParts.join('\n')
}

/**
 * Formats inline markdown tokens (links, code, bold, italics).
 * @param {string} text - Inline text string
 * @returns {string} HTML formatted inline text
 */
function inlineFormat (text) {
  const result = text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  return result
}

/**
 * Parses release post markdown or changelog into structured timeline fields.
 * @param {string} markdown - Release post markdown or changelog snippet
 * @param {string} version - Clean version string (e.g., "1.0.0-rc.10")
 * @param {string} [packageName='coralite'] - Package name
 * @returns {{ title: string, summary: string, html: string }} Parsed entry components
 */
export function parseReleaseNotesToEntry (markdown, version, packageName = 'coralite') {
  const cleanVer = version.replace(/^v/, '')
  let title = `${packageName} v${cleanVer}`
  let summary = `Coralite ${packageName} release v${cleanVer}.`

  if (!markdown || typeof markdown !== 'string') {
    return {
      title,
      summary,
      html: `<p>${summary}</p>`
    }
  }

  const lines = markdown.split(/\r?\n/)
  const bodyLines = []
  let foundOverview = false
  const overviewLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Title from H1
    if (line.startsWith('# ') && !foundOverview) {
      title = line.slice(2).trim()
      continue
    }

    // Skip leading H2 if it matches package or version
    if (bodyLines.length === 0 && !foundOverview && line.startsWith('## ')) {
      const headingText = line.slice(3).trim().toLowerCase()
      if (headingText.includes(cleanVer.toLowerCase()) || headingText.includes(packageName.toLowerCase())) {
        continue
      }
    }

    // Overview section
    if (line.startsWith('## Release Overview')) {
      foundOverview = true
      continue
    }

    if (foundOverview) {
      if (line.startsWith('## ') || line.startsWith('### ') || line === '---') {
        foundOverview = false
        bodyLines.push(lines[i])
      } else if (line.length > 0) {
        overviewLines.push(line)
      }
      continue
    }

    bodyLines.push(lines[i])
  }

  if (overviewLines.length > 0) {
    summary = overviewLines.join(' ')
  }

  const html = convertMarkdownToTimelineHtml(bodyLines.join('\n'))

  return {
    title,
    summary,
    html
  }
}

/**
 * Creates or updates an entry in the website/src/data/changelog.json array.
 * @param {Object} options - Changelog entry options
 * @param {string} options.version - Version string
 * @param {string} [options.packageName='coralite'] - Package name
 * @param {string} [options.date] - ISO date string
 * @param {string} [options.markdown] - Raw markdown release notes
 * @param {string} [options.title] - Override title
 * @param {string} [options.summary] - Override summary
 * @param {string} [options.html] - Override HTML
 * @param {string} [options.jsonPath] - Target path to changelog.json
 * @returns {Array<Object>} Updated changelog entries array
 */
export function updateChangelogData ({
  version,
  packageName = 'coralite',
  date = null,
  markdown = '',
  title = null,
  summary = null,
  html = null,
  jsonPath = null
}) {
  const cleanVer = version.replace(/^v/, '')
  const tag = `${packageName}-v${cleanVer}`
  const id = `${packageName}-v${cleanVer.replace(/\./g, '-')}`
  const entryDate = date || new Date().toISOString()
  const formattedDate = formatChangelogDate(entryDate)

  const parsed = parseReleaseNotesToEntry(markdown, cleanVer, packageName)

  const newEntry = {
    id,
    version: cleanVer,
    package: packageName,
    tag,
    date: entryDate,
    formattedDate,
    title: title || parsed.title,
    summary: summary || parsed.summary,
    html: html || parsed.html
  }

  let entries = []
  const resolvedPath = jsonPath || path.resolve(process.cwd(), 'website/src/data/changelog.json')
  mkdirSync(path.dirname(resolvedPath), { recursive: true })

  if (existsSync(resolvedPath)) {
    try {
      const content = readFileSync(resolvedPath, 'utf8')
      const parsedEntries = JSON.parse(content)
      if (Array.isArray(parsedEntries)) {
        entries = parsedEntries
      }
    } catch {
      entries = []
    }
  }

  // Idempotent upsert: replace existing entry for same tag/id if present
  const existingIndex = entries.findIndex(e => e.tag === tag || e.id === id)
  if (existingIndex !== -1) {
    entries[existingIndex] = {
      ...entries[existingIndex],
      ...newEntry
    }
  } else {
    entries.push(newEntry)
  }

  // Sort entries descending by date and version
  entries.sort((a, b) => {
    const timeA = new Date(a.date).getTime()
    const timeB = new Date(b.date).getTime()
    if (timeA !== timeB) {
      return timeB - timeA
    }
    const cleanA = semver.clean(a.version) || a.version
    const cleanB = semver.clean(b.version) || b.version
    if (semver.valid(cleanA) && semver.valid(cleanB)) {
      return semver.rcompare(cleanA, cleanB)
    }
    return 0
  })

  writeFileSync(resolvedPath, JSON.stringify(entries, null, 2) + '\n', 'utf8')
  return entries
}
