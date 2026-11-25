import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MULTIPLIERS = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000
}

/**
 * Normalises a keyword for comparisons and lookups.
 * @param {string} value - Raw keyword.
 * @returns {string} Lowercase, whitespace-collapsed keyword.
 */
export function normalizeKeyword (value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Parses a numeric cell, including Google's range values such as `1K – 10K`.
 * @param {string} value - Raw cell value.
 * @returns {number} Lower-bound numeric value, or zero when unparseable.
 */
export function parseLooseNumber (value) {
  const raw = String(value ?? '').replace(/[",\s]/g, '')
  if (!raw) {
    return 0
  }

  const rangeMatch = raw.match(/^([\d.]+)([kmb]?)[-–—]([\d.]+)([kmb]?)$/i)
  if (rangeMatch) {
    const lower = Number(rangeMatch[1])
    const multiplier = MULTIPLIERS[rangeMatch[2].toLowerCase()] || 1
    return Number.isFinite(lower) ? lower * multiplier : 0
  }

  const singleMatch = raw.match(/^([\d.]+)([kmb]?)$/i)
  if (singleMatch) {
    const number = Number(singleMatch[1])
    const multiplier = MULTIPLIERS[singleMatch[2].toLowerCase()] || 1
    return Number.isFinite(number) ? number * multiplier : 0
  }

  const leadingNumber = raw.match(/\d+/)
  return leadingNumber ? Number(leadingNumber[0]) : 0
}

/**
 * Decodes an exported CSV/TSV buffer, detecting UTF-16 and UTF-8 byte order marks.
 * @param {Buffer} buffer - Raw file contents.
 * @returns {string} Decoded text.
 */
export function decodeTableBuffer (buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return buffer.toString('utf16le', 2)
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    const swapped = Buffer.from(buffer.subarray(2))
    swapped.swap16()
    return swapped.toString('utf16le')
  }
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.toString('utf8', 3)
  }
  return buffer.toString('utf8')
}

/**
 * Reads a delimited file and returns its rows.
 * @param {string} filePath - File path.
 * @returns {{ delimiter: string, rows: string[][] }} Parsed rows and detected delimiter.
 */
export function readDelimitedFile (filePath) {
  const text = decodeTableBuffer(readFileSync(filePath))
  const firstLines = text.split(/\r?\n/).slice(0, 8).join('\n')
  const delimiter = (firstLines.match(/\t/g) || []).length >= (firstLines.match(/,/g) || []).length ? '\t' : ','
  return {
    delimiter,
    rows: parseDelimitedText(text, delimiter)
  }
}

/**
 * Parses delimited text into rows, honouring quoted cells and escaped quotes.
 * @param {string} text - Delimited text.
 * @param {string} delimiter - Single-character delimiter.
 * @returns {string[][]} Cell rows.
 */
export function parseDelimitedText (text, delimiter) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    const nextCharacter = text[index + 1]

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }

    if (character === delimiter && !quoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += character
  }

  if (cell || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter(entries => entries.some(entry => entry.trim() !== ''))
}

/**
 * Finds the first row index whose cells match every requested column fragment.
 * @param {string[][]} rows - Parsed rows.
 * @param {string[]} fragments - Required lowercase header fragments.
 * @returns {number} Header row index, or -1 when not found.
 */
export function findHeaderRow (rows, fragments) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const cells = rows[rowIndex].map(cell => normalizeHeaderCell(cell))
    const matches = fragments.every(fragment => cells.some(cell => cell.includes(fragment)))
    if (matches) {
      return rowIndex
    }
  }
  return -1
}

/**
 * Normalises a header cell for fragment matching.
 * @param {string} value - Raw header cell.
 * @returns {string} Lowercase header with underscores and repeated spaces collapsed.
 */
function normalizeHeaderCell (value) {
  return String(value ?? '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ')
}

/**
 * Builds a column-name to column-index map for a header row.
 * @param {string[]} header - Header cells.
 * @returns {Map<string, number>} Column index lookup.
 */
export function headerIndex (header) {
  const index = new Map()
  header.forEach((cell, cellIndex) => {
    index.set(normalizeHeaderCell(cell), cellIndex)
  })
  return index
}

/**
 * Finds a column index by header fragment.
 * @param {Map<string, number>} index - Header index map.
 * @param {string[]} fragments - Candidate fragments in priority order.
 * @returns {number} Column index, or -1 when absent.
 */
export function findColumn (index, fragments) {
  for (const fragment of fragments) {
    for (const [header, column] of index) {
      if (header.includes(fragment)) {
        return column
      }
    }
  }
  return -1
}

/**
 * Parses a Google Keyword Planner "Keyword stats" export.
 * @param {string} text - Decoded export text.
 * @param {string} [delimiter='\t'] - Detected delimiter.
 * @returns {Map<string, { volume: number, competition: string }>} Keyword metrics.
 */
export function parseKeywordPlannerText (text, delimiter = '\t') {
  const rows = parseDelimitedText(text, delimiter)
  const headerRow = findHeaderRow(rows, ['keyword', 'monthly searches'])
  const metrics = new Map()

  if (headerRow === -1) {
    return metrics
  }

  const index = headerIndex(rows[headerRow])
  const keywordColumn = findColumn(index, ['keyword'])
  const volumeColumn = findColumn(index, ['avg. monthly searches', 'monthly searches'])
  const competitionColumn = findColumn(index, ['competition'])

  for (const row of rows.slice(headerRow + 1)) {
    const keyword = normalizeKeyword(row[keywordColumn])
    if (!keyword) {
      continue
    }
    metrics.set(keyword, {
      volume: parseLooseNumber(row[volumeColumn]),
      competition: competitionColumn === -1 ? '' : String(row[competitionColumn] || '').trim()
    })
  }

  return metrics
}

/**
 * Loads and merges every Keyword Planner export in a directory plus manual overrides.
 * @param {string} directory - Directory containing exported files.
 * @returns {Map<string, { volume: number, competition: string, source: string }>} Merged metrics.
 */
export function loadKeywordPlannerDirectory (directory) {
  const merged = new Map()
  let files = []
  try {
    files = readdirSync(directory)
  } catch {
    return merged
  }

  const exportFiles = files.filter(file => /^keyword stats .*\.csv$/i.test(file)).sort()
  const manualFiles = files.filter(file => /^manual.*\.csv$/i.test(file)).sort()

  for (const file of [...exportFiles, ...manualFiles]) {
    const { delimiter } = readDelimitedFile(join(directory, file))
    const text = decodeTableBuffer(readFileSync(join(directory, file)))
    const metrics = parseKeywordPlannerText(text, delimiter)
    const source = /^manual/i.test(file) ? 'manual' : 'export'
    for (const [keyword, value] of metrics) {
      merged.set(keyword, {
        ...value,
        source
      })
    }
  }

  return merged
}

/**
 * Parses a Google Search Console performance CSV export.
 * @param {string} text - Decoded export text.
 * @param {string} [delimiter=','] - Detected delimiter.
 * @returns {Map<string, { impressions: number, clicks: number, position: number }>} Query metrics.
 */
export function parseSearchConsoleText (text, delimiter = ',') {
  const rows = parseDelimitedText(text, delimiter)
  const headerRow = findHeaderRow(rows, ['query', 'impressions'])
  const metrics = new Map()

  if (headerRow === -1) {
    return metrics
  }

  const index = headerIndex(rows[headerRow])
  const queryColumn = findColumn(index, ['query', 'top queries'])
  const impressionsColumn = findColumn(index, ['impressions'])
  const clicksColumn = findColumn(index, ['clicks'])
  const positionColumn = findColumn(index, ['position'])

  for (const row of rows.slice(headerRow + 1)) {
    const query = normalizeKeyword(row[queryColumn])
    if (!query) {
      continue
    }
    metrics.set(query, {
      impressions: parseLooseNumber(row[impressionsColumn]),
      clicks: clicksColumn === -1 ? 0 : parseLooseNumber(row[clicksColumn]),
      position: positionColumn === -1 ? 0 : Number.parseFloat(String(row[positionColumn] || '0'))
    })
  }

  return metrics
}

/**
 * Loads an optional Search Console export.
 * @param {string} filePath - CSV path.
 * @returns {Map<string, { impressions: number, clicks: number, position: number }>} Query metrics.
 */
export function loadSearchConsoleFile (filePath) {
  try {
    const text = decodeTableBuffer(readFileSync(filePath))
    return parseSearchConsoleText(text)
  } catch {
    return new Map()
  }
}

/**
 * Parses the SERP notes CSV written by the pipeline.
 * @param {string} text - CSV text.
 * @returns {Map<string, { weakness: number, notes: string, source: string, checkedAt: string }>} Notes by keyword.
 */
export function parseSerpNotesText (text) {
  const rows = parseDelimitedText(text, ',')
  const headerRow = findHeaderRow(rows, ['keyword', 'serp_weakness'])
  const notes = new Map()

  if (headerRow === -1) {
    return notes
  }

  const index = headerIndex(rows[headerRow])
  const keywordColumn = findColumn(index, ['keyword'])
  const weaknessColumn = findColumn(index, ['serp_weakness'])
  const notesColumn = findColumn(index, ['notes'])
  const sourceColumn = findColumn(index, ['source'])
  const checkedColumn = findColumn(index, ['checked_at'])

  for (const row of rows.slice(headerRow + 1)) {
    const keyword = normalizeKeyword(row[keywordColumn])
    if (!keyword) {
      continue
    }
    notes.set(keyword, {
      weakness: Number.parseFloat(String(row[weaknessColumn] || '0')) || 0,
      notes: String(row[notesColumn] || ''),
      source: String(row[sourceColumn] || ''),
      checkedAt: String(row[checkedColumn] || '')
    })
  }

  return notes
}

/**
 * Loads SERP notes when the file exists.
 * @param {string} filePath - CSV path.
 * @returns {Map<string, { weakness: number, notes: string, source: string, checkedAt: string }>} Notes by keyword.
 */
export function loadSerpNotesFile (filePath) {
  try {
    return parseSerpNotesText(readFileSync(filePath, 'utf8'))
  } catch {
    return new Map()
  }
}

/**
 * Serialises SERP notes to CSV.
 * @param {Map<string, { weakness: number, notes: string, source: string, checkedAt: string }>} notes - Notes by keyword.
 * @returns {string} CSV content.
 */
export function serpNotesToCsv (notes) {
  const header = 'keyword,serp_weakness,notes,source,checked_at'
  const lines = [header]
  for (const [keyword, note] of [...notes.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    lines.push([
      csvEscape(keyword),
      csvEscape(note.weakness),
      csvEscape(note.notes),
      csvEscape(note.source),
      csvEscape(note.checkedAt)
    ].join(','))
  }
  return `${lines.join('\n')}\n`
}

/**
 * Writes SERP notes to disk.
 * @param {string} filePath - Destination CSV path.
 * @param {Map<string, { weakness: number, notes: string, source: string, checkedAt: string }>} notes - Notes by keyword.
 */
export function writeSerpNotesFile (filePath, notes) {
  writeFileSync(filePath, serpNotesToCsv(notes))
}

/**
 * Escapes a value for CSV output.
 * @param {unknown} value - Cell value.
 * @returns {string} Escaped cell.
 */
export function csvEscape (value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * Serialises an array of records to CSV.
 * @param {Array<Record<string, unknown>>} records - Records to serialise.
 * @param {string[]} columns - Column order.
 * @returns {string} CSV content.
 */
export function recordsToCsv (records, columns) {
  const lines = [columns.join(',')]
  for (const record of records) {
    lines.push(columns.map(column => csvEscape(record[column])).join(','))
  }
  return `${lines.join('\n')}\n`
}

/**
 * Parses a browser-exported SERP CSV with position/title/url columns.
 * @param {string} text - CSV text.
 * @returns {Map<string, Array<{ position: number, title: string, url: string, snippet: string }>>} Results by keyword.
 */
export function parseSerpExportText (text) {
  const rows = parseDelimitedText(text, ',')
  const headerRow = findHeaderRow(rows, ['keyword', 'url'])
  const results = new Map()

  if (headerRow === -1) {
    return results
  }

  const index = headerIndex(rows[headerRow])
  const keywordColumn = findColumn(index, ['keyword'])
  const positionColumn = findColumn(index, ['position'])
  const titleColumn = findColumn(index, ['title'])
  const urlColumn = findColumn(index, ['url'])
  const snippetColumn = findColumn(index, ['snippet', 'description'])

  for (const row of rows.slice(headerRow + 1)) {
    const keyword = normalizeKeyword(row[keywordColumn])
    if (!keyword) {
      continue
    }
    if (!results.has(keyword)) {
      results.set(keyword, [])
    }
    results.get(keyword).push({
      position: parseLooseNumber(row[positionColumn]) || results.get(keyword).length + 1,
      title: String(row[titleColumn] || ''),
      url: String(row[urlColumn] || ''),
      snippet: snippetColumn === -1 ? '' : String(row[snippetColumn] || '')
    })
  }

  return results
}

/**
 * Loads a browser-exported SERP CSV when present.
 * @param {string} filePath - CSV path.
 * @returns {Map<string, Array<{ position: number, title: string, url: string, snippet: string }>>} Results by keyword.
 */
export function loadSerpExportFile (filePath) {
  try {
    return parseSerpExportText(readFileSync(filePath, 'utf8'))
  } catch {
    return new Map()
  }
}
