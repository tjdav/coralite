import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { generateColorizedDiff } from '../component/fixer.js'
import { extractScriptTagsFromHTML } from '../utils/parse.js'
import { extractPageScript } from '../parser/html.js'
import {
  PAGE_EXPORTS,
  PAGE_HANDLER_EXPORTS,
  PAGE_CONFIG_EXPORTS,
  REJECTED_PAGE_EXPORTS
} from '../../shared/page.js'

const PAGE_EXPORT_KEYS = new Set(PAGE_EXPORTS)

/**
 * Resolves a property key name from an Acorn property node.
 *
 * @param {Object} prop - Acorn property node.
 * @returns {string|null} Property name or null when unsupported.
 */
function getPropertyName (prop) {
  if (prop.computed) {
    return null
  }
  if (prop.key.type === 'Identifier') {
    return prop.key.name
  }
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') {
    return prop.key.value
  }
  return null
}

/**
 * Re-indents a multi-line block so its closing brace aligns with the export.
 *
 * @param {string} source - Block source starting with `{`.
 * @param {string} indent - Target indentation for the closing brace.
 * @returns {string} Re-indented block.
 */
function reindentBlock (source, indent) {
  const lines = source.split('\n')
  if (lines.length === 1) {
    return source
  }
  const inner = lines.slice(1, -1)
  const nonEmpty = inner.filter(line => line.trim() !== '')
  let base = 0
  if (nonEmpty.length > 0) {
    base = Math.min(...nonEmpty.map(line => {
      const match = line.match(/^[ \t]*/)
      return match ? match[0].length : 0
    }))
  }
  const basePrefix = ' '.repeat(base)
  const output = [lines[0]]
  for (const line of inner) {
    if (line.trim() === '') {
      output.push('')
      continue
    }
    const stripped = line.startsWith(basePrefix) ? line.slice(base) : line.replace(/^\s+/, '')
    output.push(`${indent}  ${stripped}`)
  }
  const last = lines[lines.length - 1]
  output.push(`${indent}${last.trimStart()}`)
  return output.join('\n')
}

/**
 * Builds an `export function` declaration from a function expression or arrow.
 *
 * @param {string} name - Export name.
 * @param {Object} fn - FunctionExpression or ArrowFunctionExpression node.
 * @param {string} source - Original script source.
 * @param {string} indent - Line indentation for the generated declaration.
 * @returns {string} Generated function declaration.
 */
function buildFunctionDeclaration (name, fn, source, indent) {
  const asyncPrefix = fn.async ? 'async ' : ''
  let params = ''
  if (fn.params.length > 0) {
    const first = fn.params[0]
    const last = fn.params[fn.params.length - 1]
    params = source.slice(first.start, last.end)
  }
  let body
  if (fn.body.type === 'BlockStatement') {
    body = reindentBlock(source.slice(fn.body.start, fn.body.end), indent)
  } else {
    body = `{ return ${source.slice(fn.body.start, fn.body.end)} }`
  }
  return `${indent}export ${asyncPrefix}function ${name} (${params}) ${body}`
}

/**
 * Returns the indentation of the line containing the given offset.
 *
 * @param {string} source - Script source.
 * @param {number} offset - Character offset.
 * @returns {string} Leading whitespace.
 */
function lineIndentAt (source, offset) {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1
  const match = source.slice(lineStart, offset).match(/^[ \t]*/)
  return match ? match[0] : ''
}

/**
 * Converts a definePage() default export or legacy bare page handlers to flat exports.
 *
 * @param {string} scriptContent - Raw module script content.
 * @returns {{ code: string, modified: boolean, skipped: string[] }} Transformed script and skip reasons.
 */
export function transformScriptToFlat (scriptContent) {
  let ast
  const comments = []
  try {
    ast = parseJS(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true,
      locations: true,
      onComment: (isBlock, text, start, end) => {
        comments.push({
          isBlock,
          start,
          end
        })
      }
    })
  } catch {
    return {
      code: scriptContent,
      modified: false,
      skipped: ['Script could not be parsed']
    }
  }

  if (!ast || !ast.body) {
    return {
      code: scriptContent,
      modified: false,
      skipped: []
    }
  }

  const skipped = []
  const edits = []

  let definePageCall = null
  let definePageDecl = null
  let definePageImport = null
  let hasBareHandlers = false

  for (const node of ast.body) {
    if (node.type === 'ImportDeclaration' && node.source?.value === 'coralite') {
      for (const spec of node.specifiers || []) {
        if (spec.local?.name === 'definePage') {
          definePageImport = {
            node,
            specifierCount: (node.specifiers || []).length,
            specifierName: spec.type === 'ImportSpecifier' && spec.imported?.type === 'Identifier'
              ? spec.imported.name
              : 'definePage'
          }
        }
      }
    }

    if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration
      if (
        decl?.type === 'CallExpression' &&
        decl.callee?.type === 'Identifier' &&
        decl.callee.name === 'definePage' &&
        decl.arguments?.[0]?.type === 'ObjectExpression'
      ) {
        definePageCall = decl
        definePageDecl = node
      }
    }

    if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration') {
      for (const decl of node.declaration.declarations) {
        if (decl.id?.type === 'Identifier' && PAGE_HANDLER_EXPORTS.has(decl.id.name)) {
          hasBareHandlers = true
        }
      }
    }
  }

  if (definePageCall) {
    let otherDefinePageCall = false
    walkJS(ast, {
      CallExpression (node) {
        if (
          node !== definePageCall &&
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'definePage'
        ) {
          otherDefinePageCall = true
        }
      }
    })
    if (otherDefinePageCall) {
      return {
        code: scriptContent,
        modified: false,
        skipped: ['definePage is referenced more than once; migrate manually']
      }
    }
  }

  if (definePageCall && hasBareHandlers) {
    return {
      code: scriptContent,
      modified: false,
      skipped: ['Script mixes definePage with bare page exports; migrate manually']
    }
  }

  if (definePageCall) {
    if (definePageImport && (definePageImport.specifierCount > 1 || definePageImport.specifierName !== 'definePage')) {
      return {
        code: scriptContent,
        modified: false,
        skipped: ['definePage import is aliased or combined with other imports; migrate manually']
      }
    }

    const obj = definePageCall.arguments[0]
    if (!obj || obj.type !== 'ObjectExpression') {
      return {
        code: scriptContent,
        modified: false,
        skipped: ['definePage does not receive an object literal; migrate manually']
      }
    }
    const indent = lineIndentAt(scriptContent, definePageDecl.start)
    const declarations = []

    const objectHasComment = comments.some(comment => comment.start > obj.start && comment.end < obj.end)
    if (objectHasComment) {
      return {
        code: scriptContent,
        modified: false,
        skipped: ['definePage block contains comments; migrate manually']
      }
    }

    for (const prop of obj.properties) {
      if (prop.type !== 'Property' || prop.computed) {
        return {
          code: scriptContent,
          modified: false,
          skipped: ['definePage block contains a spread or computed property; migrate manually']
        }
      }

      const keyName = getPropertyName(prop)
      if (!keyName) {
        return {
          code: scriptContent,
          modified: false,
          skipped: ['definePage block contains an unsupported property key; migrate manually']
        }
      }

      if (REJECTED_PAGE_EXPORTS[keyName] || !PAGE_EXPORT_KEYS.has(keyName)) {
        return {
          code: scriptContent,
          modified: false,
          skipped: [`definePage block property "${keyName}" is not a valid page export; migrate manually`]
        }
      }

      if (PAGE_HANDLER_EXPORTS.has(keyName)) {
        const value = prop.value
        if (value.type !== 'FunctionExpression' && value.type !== 'ArrowFunctionExpression') {
          return {
            code: scriptContent,
            modified: false,
            skipped: [`definePage handler "${keyName}" is not an inline function; migrate manually`]
          }
        }
        declarations.push(buildFunctionDeclaration(keyName, value, scriptContent, indent))
      } else if (PAGE_CONFIG_EXPORTS.has(keyName)) {
        const valueSource = reindentBlock(scriptContent.slice(prop.value.start, prop.value.end), indent)
        declarations.push(`${indent}export const ${keyName} = ${valueSource}`)
      }
    }

    const replacement = declarations.join('\n\n')
    const removeStart = definePageDecl.start
    const removeEnd = definePageDecl.end
    const lineStart = scriptContent.lastIndexOf('\n', removeStart - 1) + 1
    const leading = scriptContent.slice(lineStart, removeStart)
    const editStart = /^\s*$/.test(leading) ? lineStart : removeStart
    edits.push({
      start: editStart,
      end: removeEnd,
      text: replacement
    })

    if (definePageImport) {
      const importNode = definePageImport.node
      let importStart = importNode.start
      const importLineStart = scriptContent.lastIndexOf('\n', importStart - 1) + 1
      if (/^\s*$/.test(scriptContent.slice(importLineStart, importStart))) {
        importStart = importLineStart
      }
      let importEnd = importNode.end
      if (scriptContent.slice(importEnd, importEnd + 1) === '\n') {
        importEnd++
      }
      edits.push({
        start: importStart,
        end: importEnd,
        text: ''
      })
    }
  } else {
    // Normalize legacy bare `export const server/paths = ...` handlers.
    for (const node of ast.body) {
      if (node.type !== 'ExportNamedDeclaration' || node.declaration?.type !== 'VariableDeclaration') {
        continue
      }
      for (const decl of node.declaration.declarations) {
        if (decl.id?.type !== 'Identifier' || !PAGE_HANDLER_EXPORTS.has(decl.id.name)) {
          continue
        }
        if (!decl.init || (decl.init.type !== 'FunctionExpression' && decl.init.type !== 'ArrowFunctionExpression')) {
          skipped.push(`Legacy handler "${decl.id.name}" is not an inline function; migrate manually`)
          continue
        }
        const indent = lineIndentAt(scriptContent, node.start)
        edits.push({
          start: node.start,
          end: node.end,
          text: buildFunctionDeclaration(decl.id.name, decl.init, scriptContent, indent)
        })
      }
    }
  }

  if (edits.length === 0) {
    return {
      code: scriptContent,
      modified: false,
      skipped
    }
  }

  edits.sort((a, b) => b.start - a.start)
  let nextCode = scriptContent
  for (const edit of edits) {
    nextCode = nextCode.slice(0, edit.start) + edit.text + nextCode.slice(edit.end)
  }
  nextCode = nextCode.replace(/^(?:[ \t]*\n)+/, '\n')

  return {
    code: nextCode,
    modified: nextCode !== scriptContent,
    skipped
  }
}

/**
 * Applies deterministic AST auto-fixes for pages (definePage → flat exports).
 *
 * @param {string} sourceCode - Raw page file content
 * @param {Array<import('../../../types/index.js').CoraliteDiagnostic>} [_diagnostics=null] - Pre-computed diagnostics
 * @param {Object} [options={}] - Options (filePath, dryRun, migratePages)
 * @returns {{ outputCode: string, modified: boolean, fixesApplied: Array<Object>, skipped: string[], diff: string }} Fix result
 */
export function applyPageFixes (sourceCode, _diagnostics = null, options = {}) {
  const filePath = options.filePath || ''

  if (!options.migratePages) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      skipped: [],
      diff: ''
    }
  }

  let scriptTag = null
  try {
    scriptTag = extractPageScript(sourceCode, { filePath }).tag
  } catch {
    scriptTag = null
  }

  if (!scriptTag) {
    const scripts = extractScriptTagsFromHTML(sourceCode)
    scriptTag = scripts.find(script => {
      const type = script.attribs?.type ? String(script.attribs.type).trim().toLowerCase() : ''
      return type === 'module'
    }) || scripts.find(script => !script.attribs?.type)
  }

  if (!scriptTag) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      skipped: [],
      diff: ''
    }
  }

  const scriptContent = scriptTag.content
  const scriptStart = scriptTag.contentStart
  const scriptEnd = scriptTag.contentEnd

  const { code: newScriptContent, modified, skipped } = transformScriptToFlat(scriptContent)

  if (!modified) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      skipped,
      diff: ''
    }
  }

  const outputCode = sourceCode.slice(0, scriptStart) + newScriptContent + sourceCode.slice(scriptEnd)
  const fixesApplied = [{
    code: 'migrate_define_page_to_flat',
    description: 'Convert page configuration to flat named exports'
  }]

  const diff = generateColorizedDiff(sourceCode, outputCode, filePath)

  return {
    outputCode,
    modified: true,
    fixesApplied,
    skipped,
    diff
  }
}
