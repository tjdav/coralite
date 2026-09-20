import { Parser } from 'htmlparser2'
import { parse as parseJS } from 'acorn'
import { ancestor as walkAncestorJS } from 'acorn-walk'
import { readFile, access } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import kleur from 'kleur'
import { camelToKebab, stripHtmlComments } from './utils/core.js'
import { createDiagnostic, formatDiagnosticTerminal, normalizeErrorCodes, matchesErrorCode, getLocForSubstring } from './utils/diagnostics.js'
import { discoverHtmlFiles } from './utils/server/html.js'
import { getIgnoreAttributeMap, findAttributesToIgnore } from './utils/server/parse.js'

/**
 * @import {
 *   CoraliteDiagnostic,
 *   CoraliteValidationSummary,
 *   Attribute
 * } from '../types/index.js'
 */

const INERT_TAGS = new Set(['template', 'code', 'pre', 'noscript'])
const DECLARATOR_QUERY_METHODS = new Set(['querySelector', 'querySelectorAll', 'getElementById', 'getElementsByTagName', 'getElementsByClassName'])
const COMPOUND_QUERY_METHODS = new Set(['querySelector', 'querySelectorAll', 'getElementsByClassName', 'getElementsByTagName', 'matches', 'closest'])
const MUTABLE_HTML_PROPERTIES = new Set(['innerHTML', 'outerHTML'])
const REF_QUERY_METHODS = new Set(['querySelector', 'querySelectorAll', 'getElementById'])

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
 * Validates a page HTML document source code against known component schemas and encapsulation rules.
 *
 * @param {string} sourceCode - Raw HTML page source code
 * @param {Object} [options={}] - Validation options
 * @param {string} [options.filePath=''] - File path for diagnostics
 * @param {Map<string, Object>|Record<string, Object>} [options.knownComponents] - Map or object of registered component definitions
 * @param {Array<string|Attribute>|Set<string>|string} [options.ignoreByAttribute] - Attributes that bypass custom element tag checks
 * @param {string[]|Set<string>|string} [options.ignoreAttributes] - Attributes that bypass custom element tag checks
 * @param {string[]|Set<string>|string} [options.skipRenderByAttribute] - Alias for ignoreAttributes
 * @param {string[]|Set<string>|string} [options.ignoreTags] - Custom element tags to skip validation for
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

  let rawIgnoreConfig = options.ignoreByAttribute || options.ignoreAttributes || options.skipRenderByAttribute
  if (typeof rawIgnoreConfig === 'string') {
    rawIgnoreConfig = [rawIgnoreConfig]
  } else if (rawIgnoreConfig instanceof Set) {
    rawIgnoreConfig = Array.from(rawIgnoreConfig)
  }
  const ignoreAttributeMap = getIgnoreAttributeMap(rawIgnoreConfig)

  // Normalize ignoreTags
  const ignoreTags = new Set()
  const addIgnoreTags = (list) => {
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
        ignoreTags.add(item.toLowerCase().trim())
      }
    }
  }
  addIgnoreTags(options.ignoreTags)

  // Pre-pass: scan inline <script> blocks for customElements.define calls
  const scriptRegex = /<script[\s\S]*?>([\s\S]*?)<\/script>/gi
  let scriptMatch
  while ((scriptMatch = scriptRegex.exec(cleanSourceCode)) !== null) {
    const code = scriptMatch[1]
    if (code && code.trim()) {
      try {
        const ast = parseJS(code, {
          ecmaVersion: 'latest',
          sourceType: 'module'
        })
        walkAncestorJS(ast, {
          CallExpression (node) {
            if (
              node.callee &&
              node.callee.type === 'MemberExpression' &&
              node.callee.object &&
              node.callee.object.type === 'Identifier' &&
              node.callee.object.name === 'customElements' &&
              node.callee.property &&
              node.callee.property.type === 'Identifier' &&
              node.callee.property.name === 'define' &&
              node.arguments.length > 0
            ) {
              const arg0 = node.arguments[0]
              if (arg0 && arg0.type === 'Literal' && typeof arg0.value === 'string') {
                const definedTag = camelToKebab(arg0.value.toLowerCase().trim())
                knownMap.set(definedTag, {
                  attributes: {},
                  slots: []
                })
              }
            }
          }
        })
      } catch {
        // Ignore syntax errors in pre-pass
      }
    }
  }

  let currentSection = null
  let scriptContent = ''
  let scriptSearchOffset = 0

  const inertStack = []

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

        let isCustomElementPushedToInert = false

        const hasIgnoredAttr = ignoreAttributeMap && attribs ? findAttributesToIgnore(ignoreAttributeMap, attribs) : false

        if (inertStack.length > 0) {
          // Inside an inert subtree: skip custom element (CORALITE-PAGE-101) and required attribute (CORALITE-PAGE-102) validation
        } else if (tagName.includes('-')) {
          const normTag = camelToKebab(tagName)

          if (ignoreTags.has(normTag) || ignoreTags.has(tagName)) {
            // Skip custom element check
          } else if (hasIgnoredAttr) {
            inertStack.push({
              tag: tagName,
              reason: 'ignored-attr'
            })
            isCustomElementPushedToInert = true
          } else {
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
                cause: 'Custom elements rendered in page HTML must be defined in the components directory, registered by an isomorphic plugin, or configured in ignoreByAttribute or ignoreTags.'
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

              // Check if component defines custom slots
              if (compDef.slots && compDef.slots.length > 0) {
                inertStack.push({
                  tag: tagName,
                  reason: 'slots'
                })
                isCustomElementPushedToInert = true
              }
            }
          }
        }

        if (!isCustomElementPushedToInert) {
          const isStandardInertTag = INERT_TAGS.has(tagName)
          if (isStandardInertTag || hasIgnoredAttr) {
            const reason = hasIgnoredAttr ? 'ignored-attr' : 'inert-tag'
            inertStack.push({
              tag: tagName,
              reason
            })
          }
        }
      },

      ontext (text) {
        if (currentSection === 'script') {
          scriptContent += text
        }
      },

      onclosetag (name) {
        const tagName = name.toLowerCase()
        if (tagName === 'script' && currentSection === 'script') {
          currentSection = null
          if (scriptContent.trim()) {
            analyzeInlineScript(scriptContent, sourceCode, filePath, diagnostics, knownMap, scriptSearchOffset)
          }
          return
        }

        if (inertStack.length > 0 && inertStack[inertStack.length - 1].tag === tagName) {
          inertStack.pop()
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
        if (DECLARATOR_QUERY_METHODS.has(calleeStr)) {
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
      // Detect inline customElements.define('tag-name', ...)
      if (
        node.callee &&
          node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'customElements' &&
          node.callee.property &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'define' &&
          node.arguments.length > 0
      ) {
        const arg0 = node.arguments[0]
        if (arg0 && arg0.type === 'Literal' && typeof arg0.value === 'string') {
          const definedTag = camelToKebab(arg0.value.toLowerCase().trim())
          knownMap.set(definedTag, {
            attributes: {},
            slots: []
          })
        }
      }

      const calleeStr = getCalleeName(node.callee)

      // 1. Compound descendant selector check
      if (COMPOUND_QUERY_METHODS.has(calleeStr)) {
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
        if (MUTABLE_HTML_PROPERTIES.has(propName)) {
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
    if (REF_QUERY_METHODS.has(calleeStr)) {
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
 * @returns {Promise<Object>} Aggregated directory report
 */
export async function validatePagesDir (pagesDir, options = {}) {
  const absoluteDir = resolve(pagesDir)
  const results = []

  try {
    await access(absoluteDir)
  } catch {
    throw new Error(`Pages directory not found: ${absoluteDir}`)
  }

  for await (const file of discoverHtmlFiles({
    path: absoluteDir,
    recursive: true,
    type: 'page'
  })) {
    const fullPath = file.path.pathname
    const content = file.content ?? await readFile(fullPath, 'utf8')
    const relPath = relative(process.cwd(), fullPath)
    const result = validatePageSource(content, {
      ...options,
      filePath: relPath
    })
    const relativeToPagesDir = relative(absoluteDir, fullPath)
    result.pageName = relativeToPagesDir.replace(/\.html$/i, '')
    results.push(result)
  }

  results.sort((a, b) => (a.filePath || '').localeCompare(b.filePath || ''))

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
 * @param {string} [options.format='console'] - Format: 'console' or 'json'
 * @param {string|string[]} [options.errorCode] - Error code(s) to filter by
 * @param {string|string[]} [options.errorCodes] - Alias for errorCode
 * @param {'all'|'failed'|'passed'} [options.status] - Status filter
 * @param {boolean} [options.onlyFailed] - Display only failed files
 * @returns {string} Formatted output
 */
export function formatPageValidationReport (report, options = {}) {
  const format = options.format || 'console'
  const targetCodesSet = normalizeErrorCodes(options.errorCode || options.errorCodes)
  const isFilterActive = Boolean(targetCodesSet || options.status || options.onlyFailed)
  let effectiveStatus = options.status
  if (!effectiveStatus) {
    if (options.onlyFailed || targetCodesSet) {
      effectiveStatus = 'failed'
    } else {
      effectiveStatus = 'all'
    }
  }

  const rawPages = report?.pages || []
  const filteredPages = []

  let totalErrors = 0
  let totalWarnings = 0
  let fixableCount = 0
  let validPagesCount = 0

  for (const page of rawPages) {
    const allDiags = page.diagnostics || []
    const diagnostics = targetCodesSet ? allDiags.filter(d => matchesErrorCode(d.code, targetCodesSet)) : allDiags

    const pageErrors = diagnostics.filter(d => d.severity === 'error').length
    const pageWarnings = diagnostics.filter(d => d.severity === 'warning').length
    const pageFixable = diagnostics.filter(d => Boolean(d.fix && d.fix.action)).length
    const isPageValid = pageErrors === 0 && pageWarnings === 0

    if (effectiveStatus === 'failed' && isPageValid) {
      continue
    }
    if (effectiveStatus === 'passed' && !isPageValid) {
      continue
    }

    totalErrors += pageErrors
    totalWarnings += pageWarnings
    fixableCount += pageFixable
    if (isPageValid) {
      validPagesCount++
    }

    filteredPages.push({
      ...page,
      valid: isPageValid,
      diagnostics,
      metrics: {
        totalErrors: pageErrors,
        totalWarnings: pageWarnings
      }
    })
  }

  const totalPages = filteredPages.length

  if (format === 'json') {
    const jsonReport = {
      ...(isFilterActive ? {
        filter: {
          ...(targetCodesSet ? { errorCodes: Array.from(targetCodesSet) } : {}),
          status: effectiveStatus
        }
      } : {}),
      pages: filteredPages,
      summary: {
        totalPages,
        validPages: validPagesCount,
        errorCount: totalErrors,
        warningCount: totalWarnings,
        fixableCount
      },
      metrics: {
        totalPages,
        validPages: validPagesCount,
        totalErrors,
        totalWarnings
      }
    }
    return JSON.stringify(jsonReport, null, 2) + '\n'
  }

  let out = '\n' + kleur.bold().cyan('📄 Coralite Page Validation Report') + '\n'
  out += kleur.gray('─'.repeat(60)) + '\n\n'

  if (targetCodesSet && totalPages === 0) {
    out += kleur.green().bold(`✔ No issues matching error code(s): ${Array.from(targetCodesSet).join(', ')}\n\n`)
  } else {
    for (const page of filteredPages) {
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
  }

  out += kleur.gray('─'.repeat(60)) + '\n'
  const summaryColor = totalErrors === 0 ? kleur.green().bold : kleur.red().bold
  let summaryLine = `Summary: ${totalPages} page(s) validated | ${validPagesCount} valid | ${totalErrors} error(s) | ${totalWarnings} warning(s)`
  if (fixableCount > 0) {
    summaryLine += ` | ${fixableCount} fixable with --fix`
  }
  out += summaryColor(summaryLine) + '\n\n'

  return out
}
