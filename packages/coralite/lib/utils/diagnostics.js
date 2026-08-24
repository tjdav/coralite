import kleur from 'kleur'

/**
 * Standard semantic dictionary mapping developer ref abbreviations to HTML tag names.
 */
const TAG_SYNONYMS = {
  btn: ['button', 'input'],
  button: ['button', 'input'],
  input: ['input', 'textarea', 'select'],
  inp: ['input', 'textarea', 'select'],
  form: ['form'],
  img: ['img', 'svg', 'image', 'picture'],
  image: ['img', 'svg', 'image', 'picture'],
  link: ['a'],
  anchor: ['a'],
  nav: ['nav', 'ul', 'ol'],
  list: ['ul', 'ol', 'menu'],
  card: ['div', 'article', 'section'],
  container: ['div', 'main', 'section'],
  dialog: ['dialog'],
  modal: ['dialog', 'div']
}

/**
 * Creates a normalized CoraliteDiagnostic object with an optional codeframe snippet.
 *
 * @param {Object} params
 * @param {string} params.code
 * @param {import('../../types/component-validator.js').CoraliteDiagnosticSeverity} [params.severity='error']
 * @param {string} params.message
 * @param {string} [params.filePath]
 * @param {number} [params.line]
 * @param {number} [params.column]
 * @param {string} [params.sourceCode]
 * @param {string} [params.cause]
 * @param {import('../../types/component-validator.js').CoraliteDiagnosticFix} [params.fix]
 * @returns {import('../../types/component-validator.js').CoraliteDiagnostic}
 */
export function createDiagnostic ({ code, severity = 'error', message, filePath, line, column, sourceCode, cause, fix }) {
  const diagnostic = {
    code,
    severity,
    message,
    filePath,
    line,
    column,
    cause,
    fix
  }

  if (typeof line === 'number' && line > 0 && sourceCode) {
    diagnostic.codeframe = buildCodeframe(sourceCode, line, column)
  }

  return diagnostic
}

/**
 * Strips ANSI escape sequences from a string.
 *
 * @param {string} str - Input string
 * @returns {string} String with ANSI escape sequences removed
 */
export function stripAnsi (str) {
  if (typeof str !== 'string') {
    return ''
  }
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
}

/**
 * Checks if a ref name semantically matches an HTML tag or its attributes (id / class).
 *
 * @param {string} refName - Element ref name
 * @param {string} tagName - HTML tag name
 * @param {Record<string, string>} [attribs={}] - Attribute key-value map
 * @returns {boolean} True if semantic match is found
 */
export function isSemanticMatch (refName, tagName, attribs = {}) {
  if (!refName || typeof refName !== 'string') {
    return false
  }

  const normRef = refName.toLowerCase()
  const normTag = (tagName || '').toLowerCase()

  // 1. Direct tag match (e.g., ref="button" vs <button>)
  if (normTag && normRef === normTag) {
    return true
  }

  // 2. Tag synonyms match
  const synonyms = TAG_SYNONYMS[normRef]
  if (synonyms && normTag && synonyms.includes(normTag)) {
    return true
  }

  // Split camelCase, PascalCase, kebab-case, or snake_case refName into words
  const words = refName
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  for (const word of words) {
    if (normTag && word === normTag) {
      return true
    }
    const wordSynonyms = TAG_SYNONYMS[word]
    if (wordSynonyms && normTag && wordSynonyms.includes(normTag)) {
      return true
    }
  }

  // 3. ID matching (case-insensitive substring or token)
  const idAttr = attribs?.id
  if (idAttr && typeof idAttr === 'string') {
    const normId = idAttr.toLowerCase()
    if (normId.includes(normRef)) {
      return true
    }
    for (const word of words) {
      if (word.length >= 2 && normId.includes(word)) {
        return true
      }
    }
  }

  // 4. Class matching (case-insensitive token)
  const classAttr = attribs?.class
  if (classAttr && typeof classAttr === 'string') {
    const classTokens = classAttr.toLowerCase().split(/\s+/).filter(Boolean)
    if (classTokens.includes(normRef)) {
      return true
    }
    for (const word of words) {
      if (classTokens.includes(word)) {
        return true
      }
    }
  }

  return false
}

/**
 * Builds an ANSI-formatted codeframe snippet around a target line.
 *
 * @param {string} source - Source code string
 * @param {number} line - 1-based target line number
 * @param {number} [column] - 1-based target column number
 * @param {number} [radius=2] - Number of lines to include before and after target line
 * @returns {string} Formatted codeframe or empty string if invalid input/bounds
 */
export function buildCodeframe (source, line, column, radius = 2) {
  if (!source || typeof source !== 'string') {
    return ''
  }

  const lines = source.split(/\r?\n/)
  const totalLines = lines.length

  if (!line || line < 1 || line > totalLines) {
    return ''
  }

  const startLine = Math.max(1, line - radius)
  const endLine = Math.min(totalLines, line + radius)
  const resultLines = []

  for (let l = startLine; l <= endLine; l++) {
    const lineContent = lines[l - 1]
    const lineNumStr = String(l).padStart(4, ' ')

    if (l === line) {
      const prefix = kleur.red().bold(' > ')
      resultLines.push(`${prefix}${lineNumStr} | ${lineContent}`)
      if (typeof column === 'number' && column > 0) {
        const caretPrefix = '   ' + ' '.repeat(4) + ' | '
        const spaces = ' '.repeat(column - 1)
        resultLines.push(`${caretPrefix}${spaces}${kleur.red().bold('^')}`)
      }
    } else {
      const prefix = '   '
      resultLines.push(`${prefix}${lineNumStr} | ${lineContent}`)
    }
  }

  return resultLines.join('\n')
}

/**
 * Formats a single CoraliteDiagnostic object into a 4-part ANSI box report.
 *
 * @param {import('../../types/component-validator.js').CoraliteDiagnostic} diagnostic - The diagnostic object to format
 * @returns {string} Formatted ANSI box diagnostic string
 */
export function formatDiagnosticTerminal (diagnostic) {
  if (!diagnostic) {
    return ''
  }

  const width = 80
  const severity = diagnostic.severity || 'error'
  let titleColor = kleur.red().bold
  if (severity === 'warning') {
    titleColor = kleur.yellow().bold
  } else if (severity === 'info') {
    titleColor = kleur.cyan().bold
  }

  const codeStr = diagnostic.code ? `[${diagnostic.code}] ` : ''
  const titleText = `${codeStr}${diagnostic.message || ''}`

  // Top border: ┌─ [CODE] Message ──────
  const topPrefix = '┌─ '
  const topRawLen = topPrefix.length + titleText.length + 1
  const topFill = kleur.gray('─'.repeat(Math.max(0, width - topRawLen)))
  let output = `${kleur.gray(topPrefix)}${titleColor(titleText)} ${topFill}\n`

  // Location line if present
  if (diagnostic.filePath) {
    let loc = diagnostic.filePath
    if (typeof diagnostic.line === 'number') {
      loc += `:${diagnostic.line}`
      if (typeof diagnostic.column === 'number') {
        loc += `:${diagnostic.column}`
      }
    }
    output += `${kleur.gray('│')} File: ${loc}\n`
  }

  // Code Context section
  if (diagnostic.codeframe && diagnostic.codeframe.trim()) {
    const hdrText = '├─ Code Context '
    const hdrFill = kleur.gray('─'.repeat(Math.max(0, width - hdrText.length)))
    output += `${kleur.gray(hdrText)}${hdrFill}\n`
    output += `${diagnostic.codeframe}\n`
  }

  // Why this failed section
  if (diagnostic.cause && diagnostic.cause.trim()) {
    const hdrText = '├─ Why this failed '
    const hdrFill = kleur.gray('─'.repeat(Math.max(0, width - hdrText.length)))
    output += `${kleur.gray(hdrText)}${hdrFill}\n`
    const causeLines = diagnostic.cause.split(/\r?\n/)
    for (const cLine of causeLines) {
      output += `${kleur.gray('│')} ${cLine}\n`
    }
  }

  // Suggested 1-Shot Fix section
  if (diagnostic.fix) {
    const hdrText = '├─ Suggested 1-Shot Fix '
    const hdrFill = kleur.gray('─'.repeat(Math.max(0, width - hdrText.length)))
    output += `${kleur.gray(hdrText)}${hdrFill}\n`
    if (diagnostic.fix.description) {
      const descLines = diagnostic.fix.description.split(/\r?\n/)
      for (const dLine of descLines) {
        output += `${kleur.gray('│')} ${dLine}\n`
      }
    }
    if (diagnostic.fix.replacement) {
      const repLines = diagnostic.fix.replacement.split(/\r?\n/)
      for (const rLine of repLines) {
        output += `${kleur.gray('│')} ${rLine}\n`
      }
    }
    if (diagnostic.fix.getter) {
      if (diagnostic.fix.getter.name && diagnostic.fix.getter.code) {
        output += `${kleur.gray('│')} ${diagnostic.fix.getter.name}: ${diagnostic.fix.getter.code}\n`
      } else if (diagnostic.fix.getter.code) {
        output += `${kleur.gray('│')} ${diagnostic.fix.getter.code}\n`
      }
    }
  }

  // Bottom border: └──────────────
  output += `${kleur.gray('└' + '─'.repeat(Math.max(0, width - 1)))}`

  return output
}

/**
 * Formats a directory validation report into JSON or terminal output.
 *
 * @param {import('../../types/component-validator.js').CoraliteComponentDirectoryValidationReport} report - The directory validation report
 * @param {Object} [options={}] - Formatting options
 * @param {'json'|'console'} [options.format='console'] - Output format (json or console)
 * @returns {string} Formatted report output
 */
export function formatValidationReport (report, options = {}) {
  if (options.format === 'json') {
    return JSON.stringify(report, null, 2)
  }

  let output = '\n' + kleur.bold().cyan('🪸 Coralite Component Code & Schema Diagnostics') + '\n'
  output += kleur.gray('─'.repeat(60)) + '\n\n'

  const components = report?.components || []
  let totalComponents = report?.summary?.totalComponents
  let validComponents = report?.summary?.validComponents
  let errorCount = report?.summary?.errorCount
  let warningCount = report?.summary?.warningCount
  let fixableCount = report?.summary?.fixableCount

  let computedErrorCount = 0
  let computedWarningCount = 0
  let computedFixableCount = 0
  let computedValidComponents = 0

  for (const comp of components) {
    const diagnostics = comp.diagnostics || []
    const compErrors = diagnostics.filter(d => d.severity === 'error').length
    const compWarnings = diagnostics.filter(d => d.severity === 'warning').length
    const compFixable = diagnostics.filter(d => Boolean(d.fix && d.fix.action)).length

    computedErrorCount += compErrors
    computedWarningCount += compWarnings
    computedFixableCount += compFixable

    const isCompValid = comp.valid !== false && compErrors === 0 && compWarnings === 0
    if (isCompValid) {
      computedValidComponents++
    }

    if (diagnostics.length > 0) {
      output += `${kleur.bold(comp.filePath)}\n`
      for (const diag of diagnostics) {
        output += `${formatDiagnosticTerminal(diag)}\n`
      }
      output += '\n'
    } else {
      output += `${kleur.bold(comp.filePath)} ─ ${kleur.green().bold('✔ VALID')}\n`
      output += `  ${kleur.green('✔')} All symbols and template syntax valid.\n\n`
    }
  }

  if (totalComponents === undefined) {
    totalComponents = components.length
  }
  if (validComponents === undefined) {
    validComponents = computedValidComponents
  }
  if (errorCount === undefined) {
    errorCount = computedErrorCount
  }
  if (warningCount === undefined) {
    warningCount = computedWarningCount
  }
  if (fixableCount === undefined) {
    fixableCount = computedFixableCount
  }

  output += kleur.gray('─'.repeat(60)) + '\n'
  const summaryText = `Summary: ${totalComponents} component(s) validated | ${validComponents} valid | ${errorCount} error(s) | ${warningCount} warning(s) | ${fixableCount} fixable with --fix`
  const summaryColor = errorCount === 0 ? kleur.green().bold : kleur.red().bold

  output += summaryColor(summaryText) + '\n'

  return output
}
