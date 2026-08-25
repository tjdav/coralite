import { Parser } from 'htmlparser2'
import { parse as parseJS } from 'acorn'
import { ancestor as walkAncestorJS } from 'acorn-walk'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative, resolve, basename } from 'node:path'
import kleur from 'kleur'
import { camelToKebab } from './utils/core.js'
import { createDiagnostic, formatDiagnosticTerminal } from './utils/diagnostics.js'

/**
 * @import {
 *   CoraliteDiagnostic,
 *   CoraliteValidationSummary
 * } from '../types/index.js'
 */

/**
 * Strips HTML comments while preserving original line numbers and character offsets.
 *
 * @param {string} html - Raw HTML source code.
 * @returns {string} Cleaned HTML source code with comment contents replaced by spaces.
 */
function stripHtmlComments (html) {
  if (!html || !html.includes('<!--')) {
    return html
  }

  return html.replace(/<!--[\s\S]*?-->/g, (match) => match.replace(/[^\r\n]/g, ' '))
}

/**
 * Calculates Levenshtein distance between two strings.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance (a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

/**
 * Finds the closest matching tag from a list of known tags using edit distance / similarity.
 *
 * @param {string} unknownTag - Target unknown tag string
 * @param {IterableIterator<string>|Set<string>|Array<string>} knownTags - Known custom element tags
 * @returns {string|null} Closest tag match or null
 */
function findClosestTag (unknownTag, knownTags) {
  let closest = null
  let minDistance = Infinity

  const target = unknownTag.toLowerCase()

  for (const tag of knownTags) {
    const known = tag.toLowerCase()
    const dist = levenshteinDistance(target, known)
    const maxLen = Math.max(target.length, known.length)
    const similarity = maxLen === 0 ? 1 : 1 - (dist / maxLen)

    if ((dist <= 3 || similarity > 0.6) && dist < minDistance) {
      minDistance = dist
      closest = tag
    }
  }

  return closest
}

/**
 * Locates line and column numbers of a substring in source code.
 *
 * @param {string} source - Source code
 * @param {string} substring - Substring to search
 * @param {number} [searchFrom=0] - Offset index
 * @returns {{ line: number, column: number, index: number }} Location object
 */
function getLocForSubstring (source, substring, searchFrom = 0) {
  const index = source.indexOf(substring, searchFrom)
  if (index === -1) {
    return {
      line: 1,
      column: 1,
      index: 0
    }
  }
  let line = 1
  let lastNewLine = -1
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') {
      line++
      lastNewLine = i
    }
  }
  const column = index - lastNewLine
  return {
    line,
    column,
    index
  }
}

/**
 * Validates a page HTML document source code against known component schemas and encapsulation rules.
 *
 * @param {string} sourceCode - Raw HTML page source code
 * @param {Object} [options={}] - Validation options
 * @param {string} [options.filePath=''] - File path for diagnostics
 * @param {Map<string, Object>|Record<string, Object>} [options.knownComponents] - Map or object of registered component definitions
 * @param {string[]|Set<string>|string} [options.ignoreAttributes] - Attributes that bypass custom element tag checks
 * @param {string[]|Set<string>|string} [options.skipRenderByAttribute] - Alias for ignoreAttributes
 * @returns {Object} Validation result object
 */
export function validatePageSource (sourceCode, options = {}) {
  const filePath = options.filePath || ''
  /** @type {CoraliteDiagnostic[]} */
  const diagnostics = []

  const cleanSourceCode = stripHtmlComments(sourceCode)

  // Normalize knownComponents map
  const knownMap = new Map()
  if (options.knownComponents) {
    const entries = options.knownComponents instanceof Map
      ? options.knownComponents.entries()
      : Object.entries(options.knownComponents)

    for (const [rawKey, val] of entries) {
      const cleanKey = String(rawKey).replace(/^<|>$/g, '').trim().toLowerCase()
      const normKey = camelToKebab(cleanKey)
      knownMap.set(normKey, val)
    }
  }

  // Normalize ignoreAttributes
  const ignoreAttrs = new Set()
  const addIgnoreList = (list) => {
    if (!list) {
      return
    }
    let items = [list]
    if (Array.isArray(list)) {
      items = list
    } else if (list instanceof Set) {
      items = Array.from(list)
    }
    for (const item of items) {
      if (typeof item === 'string') {
        ignoreAttrs.add(item.toLowerCase().trim())
      }
    }
  }
  addIgnoreList(options.ignoreAttributes)
  addIgnoreList(options.skipRenderByAttribute)

  let currentSection = null
  let scriptContent = ''
  let scriptSearchOffset = 0

  const parser = new Parser(
    {
      onopentag (name, attribs) {
        const tagName = name.toLowerCase()

        if (tagName === 'script') {
          currentSection = 'script'
          scriptContent = ''
          scriptSearchOffset = cleanSourceCode.indexOf('<script')
          return
        }

        // Custom element detection (tag name containing a hyphen)
        if (tagName.includes('-')) {
          // Check if element carries an ignored attribute
          const hasIgnoredAttr = Object.keys(attribs || {}).some(attr => ignoreAttrs.has(attr.toLowerCase()))
          if (hasIgnoredAttr) {
            return
          }

          const normTag = camelToKebab(tagName)
          const tagLoc = getLocForSubstring(cleanSourceCode, `<${name}`, 0)

          if (!knownMap.has(normTag)) {
            // CORALITE-PAGE-101: Unknown Custom Element
            const closest = findClosestTag(normTag, knownMap.keys())
            const message = closest
              ? `Unknown custom element tag "<${tagName}>". Did you mean "<${closest}>"?`
              : `Unknown custom element tag "<${tagName}>"`

            diagnostics.push(createDiagnostic({
              code: 'CORALITE-PAGE-101',
              severity: 'warning',
              message,
              filePath,
              line: tagLoc.line,
              column: tagLoc.column,
              sourceCode,
              cause: 'Custom elements rendered in page HTML must be defined in the components directory, registered by an isomorphic plugin, or configured in ignoreByAttribute.'
            }))
          } else {
            // CORALITE-PAGE-102: Missing Required Attribute
            const compDef = knownMap.get(normTag) || {}
            const attrSchema = compDef.attributes || {}

            for (const [attrKey, schema] of Object.entries(attrSchema)) {
              if (schema && (schema.required === true || schema.required === 'true')) {
                const kebabAttr = camelToKebab(attrKey).toLowerCase()
                const presentAttrs = Object.keys(attribs || {}).map(a => a.toLowerCase())

                if (!presentAttrs.includes(kebabAttr)) {
                  diagnostics.push(createDiagnostic({
                    code: 'CORALITE-PAGE-102',
                    severity: 'error',
                    message: `Missing required attribute '${kebabAttr}' on <${tagName}>.`,
                    filePath,
                    line: tagLoc.line,
                    column: tagLoc.column,
                    sourceCode,
                    cause: `Attribute '${kebabAttr}' is marked as required: true in <${tagName}> schema but missing from element tag.`,
                    fix: {
                      action: 'add_required_attribute',
                      description: `Add required attribute '${kebabAttr}' to <${tagName}>`,
                      replacement: `${kebabAttr}=""`
                    }
                  }))
                }
              }
            }
          }
        }
      },

      ontext (text) {
        if (currentSection === 'script') {
          scriptContent += text
        }
      },

      onclosetag (name) {
        if (name.toLowerCase() === 'script' && currentSection === 'script') {
          currentSection = null
          if (scriptContent.trim()) {
            analyzeInlineScript(scriptContent, sourceCode, filePath, diagnostics, knownMap, scriptSearchOffset)
          }
        }
      }
    },
    {
      lowerCaseTags: true,
      lowerCaseAttributeNames: true
    }
  )

  parser.write(cleanSourceCode)
  parser.end()

  const errorCount = diagnostics.filter(d => d.severity === 'error').length
  const warningCount = diagnostics.filter(d => d.severity === 'warning').length
  const valid = errorCount === 0 && warningCount === 0

  return {
    filePath,
    valid,
    diagnostics,
    metrics: {
      totalErrors: errorCount,
      totalWarnings: warningCount
    }
  }
}

/**
 * Audits inline script AST for CORALITE-PAGE-201 encapsulation violations.
 *
 * @param {string} scriptContent - Script node text
 * @param {string} fullSourceCode - Full HTML document source
 * @param {string} filePath - Path to page file
 * @param {CoraliteDiagnostic[]} diagnostics - Array to push diagnostics
 * @param {Map<string, Object>} knownMap - Known component definitions map
 * @param {number} _scriptSearchOffset - Search index offset
 */
function analyzeInlineScript (scriptContent, fullSourceCode, filePath, diagnostics, knownMap, _scriptSearchOffset) {
  let ast
  try {
    ast = parseJS(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })
  } catch {
    return
  }

  const customElementVars = new Set()

  const isCustomElementTag = (tagStr) => {
    if (!tagStr || typeof tagStr !== 'string') {
      return false
    }
    const clean = tagStr.toLowerCase().trim()
    if (clean.includes('-')) {
      return true
    }
    if (knownMap.has(clean) || knownMap.has(camelToKebab(clean))) {
      return true
    }
    return false
  }

  const isCustomElementSelector = (selectorStr) => {
    if (!selectorStr || typeof selectorStr !== 'string') {
      return false
    }
    const tokens = selectorStr.split(/[\s>+~,]+/).filter(Boolean)
    return tokens.some(t => {
      const tag = t.replace(/^[\.#\[:]+/, '')
      return isCustomElementTag(tag)
    })
  }

  walkAncestorJS(ast, {
    VariableDeclarator (node) {
      if (!node.init || !node.id || node.id.type !== 'Identifier') {
        return
      }
      const varName = node.id.name

      if (node.init.type === 'CallExpression' && node.init.callee) {
        const calleeStr = getCalleeName(node.init.callee)
        if (['querySelector', 'querySelectorAll', 'getElementById', 'getElementsByTagName', 'getElementsByClassName'].includes(calleeStr)) {
          const firstArg = node.init.arguments[0]
          if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
            if (isCustomElementSelector(firstArg.value)) {
              customElementVars.add(varName)
            }
          }
        }
      }

      // Variable name heuristic (e.g., userCard, myElement)
      if (isCustomElementTag(camelToKebab(varName))) {
        customElementVars.add(varName)
      }
    },

    CallExpression (node) {
      const calleeStr = getCalleeName(node.callee)

      // 1. Compound descendant selector check
      if (['querySelector', 'querySelectorAll', 'getElementsByClassName', 'getElementsByTagName', 'matches', 'closest'].includes(calleeStr)) {
        if (node.arguments.length > 0) {
          const arg0 = node.arguments[0]
          if (arg0 && arg0.type === 'Literal' && typeof arg0.value === 'string') {
            const selector = arg0.value
            // Check for compound selector: custom element tag followed by descendant combinators
            const compoundRegex = /\b([a-z0-9]+-[a-z0-9-]+)\s*[\s>+~]\s*[\.\#\[:a-z0-9_-]+/i
            let match = compoundRegex.exec(selector)

            let matchedTag = match ? match[1] : null

            if (!matchedTag) {
              // Check if known component tag is followed by descendant combinator
              for (const knownTag of knownMap.keys()) {
                const reg = new RegExp(`\\b${knownTag}\\s*[\\s>+~]\\s*[\\.\\#\\[:a-z0-9_-]+`, 'i')
                if (reg.test(selector)) {
                  matchedTag = knownTag
                  break
                }
              }
            }

            if (matchedTag) {
              const line = node.loc ? node.loc.start.line : 1
              const col = node.loc ? node.loc.start.column + 1 : 1
              diagnostics.push(createDiagnostic({
                code: 'CORALITE-PAGE-201',
                severity: 'error',
                message: `Encapsulation violation: Querying inside custom element '<${matchedTag}>' via compound selector '${selector}'.`,
                filePath,
                line,
                column: col,
                sourceCode: fullSourceCode,
                cause: 'Pages are strictly consumers of components. Any logic to query or manipulate component internals violates component encapsulation and must live inside the component\'s client() block using refs().'
              }))
            }
          }
        }
      }

      // 2. Direct component mutation via .setAttribute(...)
      if (node.callee && node.callee.type === 'MemberExpression' && node.callee.property && node.callee.property.type === 'Identifier' && node.callee.property.name === 'setAttribute') {
        const objNode = node.callee.object
        if (isCustomElementRefNode(objNode, customElementVars, knownMap)) {
          const line = node.loc ? node.loc.start.line : 1
          const col = node.loc ? node.loc.start.column + 1 : 1
          diagnostics.push(createDiagnostic({
            code: 'CORALITE-PAGE-201',
            severity: 'error',
            message: 'Encapsulation violation: Calling setAttribute on custom element instance from page script.',
            filePath,
            line,
            column: col,
            sourceCode: fullSourceCode,
            cause: 'Pages are strictly consumers of components. Any logic to query or manipulate component internals violates component encapsulation and must live inside the component\'s client() block using refs().'
          }))
        }
      }
    },

    AssignmentExpression (node) {
      // Direct component mutation via .innerHTML / .outerHTML assignment
      if (node.left && node.left.type === 'MemberExpression' && node.left.property && node.left.property.type === 'Identifier') {
        const propName = node.left.property.name
        if (['innerHTML', 'outerHTML'].includes(propName)) {
          const objNode = node.left.object
          if (isCustomElementRefNode(objNode, customElementVars, knownMap)) {
            const line = node.loc ? node.loc.start.line : 1
            const col = node.loc ? node.loc.start.column + 1 : 1
            diagnostics.push(createDiagnostic({
              code: 'CORALITE-PAGE-201',
              severity: 'error',
              message: `Encapsulation violation: Direct assignment to .${propName} on custom element instance from page script.`,
              filePath,
              line,
              column: col,
              sourceCode: fullSourceCode,
              cause: 'Pages are strictly consumers of components. Any logic to query or manipulate component internals violates component encapsulation and must live inside the component\'s client() block using refs().'
            }))
          }
        }
      }
    }
  })
}

/**
 * Returns string name of a callee node.
 *
 * @param {Object} callee - Callee AST node
 * @returns {string} Callee name
 */
function getCalleeName (callee) {
  if (!callee) {
    return ''
  }
  if (callee.type === 'Identifier') {
    return callee.name
  }
  if (callee.type === 'MemberExpression' && callee.property && callee.property.type === 'Identifier') {
    return callee.property.name
  }
  return ''
}

/**
 * Determines whether an AST expression node evaluates to a custom element reference.
 *
 * @param {Object} node - AST node
 * @param {Set<string>} customElementVars - Set of detected custom element variable names
 * @param {Map<string, Object>} knownMap - Known component definitions map
 * @returns {boolean} True if custom element reference
 */
function isCustomElementRefNode (node, customElementVars, knownMap) {
  if (!node) {
    return false
  }

  if (node.type === 'Identifier') {
    if (customElementVars.has(node.name)) {
      return true
    }
    const kebab = camelToKebab(node.name).toLowerCase()
    if (kebab.includes('-') && (knownMap.has(kebab) || kebab.startsWith('user-') || kebab.startsWith('my-'))) {
      return true
    }
  }

  if (node.type === 'CallExpression') {
    const calleeStr = getCalleeName(node.callee)
    if (['querySelector', 'querySelectorAll', 'getElementById'].includes(calleeStr)) {
      const arg0 = node.arguments[0]
      if (arg0 && arg0.type === 'Literal' && typeof arg0.value === 'string') {
        const sel = arg0.value.toLowerCase()
        if (sel.includes('-')) {
          return true
        }
        for (const knownTag of knownMap.keys()) {
          if (sel.includes(knownTag)) {
            return true
          }
        }
      }
    }
  }

  return false
}

/**
 * Validates all HTML pages in a directory recursively.
 *
 * @param {string} pagesDir - Path to pages directory
 * @param {Object} [options={}] - Options for validation
 * @returns {Object} Aggregated directory report
 */
export function validatePagesDir (pagesDir, options = {}) {
  const absoluteDir = resolve(pagesDir)
  const results = []

  if (!existsSync(absoluteDir)) {
    throw new Error(`Pages directory not found: ${absoluteDir}`)
  }

  function scanDir (dir) {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        scanDir(fullPath)
      } else if (stat.isFile() && extname(entry) === '.html') {
        const content = readFileSync(fullPath, 'utf8')
        const relPath = relative(process.cwd(), fullPath)
        const result = validatePageSource(content, {
          ...options,
          filePath: relPath
        })
        result.pageName = basename(entry, '.html')
        results.push(result)
      }
    }
  }

  scanDir(absoluteDir)

  let errorCount = 0
  let warningCount = 0
  let fixableCount = 0
  let validPages = 0

  for (const res of results) {
    const errs = (res.diagnostics || []).filter(d => d.severity === 'error').length
    const warns = (res.diagnostics || []).filter(d => d.severity === 'warning').length
    const fixables = (res.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length

    errorCount += errs
    warningCount += warns
    fixableCount += fixables

    if (res.valid) {
      validPages++
    }
  }

  return {
    pages: results,
    summary: {
      totalPages: results.length,
      validPages,
      errorCount,
      warningCount,
      fixableCount
    },
    metrics: {
      totalPages: results.length,
      validPages,
      totalErrors: errorCount,
      totalWarnings: warningCount
    }
  }
}

/**
 * Formats a page validation report into human-readable terminal output or JSON string.
 *
 * @param {Object} report - Directory validation report
 * @param {Object} [options={}] - Formatting options
 * @returns {string} Formatted output
 */
export function formatPageValidationReport (report, options = {}) {
  const format = options.format || 'console'

  if (format === 'json') {
    return JSON.stringify(report, null, 2) + '\n'
  }

  let out = '\n' + kleur.bold().cyan('📄 Coralite Page Validation Report') + '\n'
  out += kleur.gray('─'.repeat(60)) + '\n\n'

  const pages = report?.pages || []
  for (const page of pages) {
    const diagnostics = page.diagnostics || []
    const status = page.valid ? kleur.green().bold('✔ VALID') : kleur.red().bold('✖ INVALID')
    out += `${kleur.bold(page.filePath)} ─ ${status}\n`

    if (diagnostics.length === 0) {
      out += `  ${kleur.green('✔')} All custom elements, attributes, and script encapsulation are valid.\n\n`
    } else {
      for (const diag of diagnostics) {
        out += `${formatDiagnosticTerminal(diag)}\n`
      }
      out += '\n'
    }
  }

  out += kleur.gray('─'.repeat(60)) + '\n'
  const summary = report?.summary || {}
  const totalPages = summary.totalPages ?? pages.length
  const validPages = summary.validPages ?? pages.filter(p => p.valid).length
  const errorCount = summary.errorCount ?? 0
  const warningCount = summary.warningCount ?? 0
  const fixableCount = summary.fixableCount ?? 0

  const summaryColor = errorCount === 0 ? kleur.green().bold : kleur.red().bold
  let summaryLine = `Summary: ${totalPages} page(s) validated | ${validPages} valid | ${errorCount} error(s) | ${warningCount} warning(s)`
  if (fixableCount > 0) {
    summaryLine += ` | ${fixableCount} fixable with --fix`
  }
  out += summaryColor(summaryLine) + '\n\n'

  return out
}
