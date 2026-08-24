import kleur from 'kleur'

/**
 * Builds an ANSI-formatted codeframe snippet around a target line.
 *
 * @param {string} source - Source code string
 * @param {number} line - 1-based target line number
 * @param {number} column - 1-based target column number
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
    const compFixable = diagnostics.filter(d => Boolean(d.fix)).length

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
