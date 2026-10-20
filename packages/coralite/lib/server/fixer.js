import { parse as parseJS } from 'acorn'
import { generateColorizedDiff } from './component-fixer.js'
import { validatePageSource } from './validator/index.js'

/**
 * Re-indents initializer lines by trimming leading base indentation and adding target indentation.
 *
 * @param {string} initCode - Original initializer source string
 * @param {string} baseIndent - Base indentation string of the original statement
 * @param {string} targetIndent - Target indentation string for inner property body
 * @returns {string} Re-indented initializer code
 */
function formatPropertyInit (initCode, baseIndent, targetIndent) {
  const lines = initCode.split('\n')
  if (lines.length === 1) {
    return lines[0]
  }

  const formattedLines = [lines[0]]
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      formattedLines.push('')
    } else {
      let stripped = line
      if (baseIndent && line.startsWith(baseIndent)) {
        stripped = line.slice(baseIndent.length)
      } else {
        stripped = line.replace(/^\s{1,4}/, '')
      }
      formattedLines.push(targetIndent + stripped)
    }
  }
  return formattedLines.join('\n')
}

/**
 * Transforms JavaScript script content from bare exports to definePage({ ... }).
 *
 * @param {string} scriptContent - Raw JS script block content
 * @returns {{ code: string, modified: boolean }} Transformed script and modification flag
 */
function transformScriptBareExports (scriptContent) {
  let ast
  try {
    ast = parseJS(scriptContent, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ranges: true,
      locations: true
    })
  } catch {
    return {
      code: scriptContent,
      modified: false
    }
  }

  if (!ast || !ast.body) {
    return {
      code: scriptContent,
      modified: false
    }
  }

  let hasDefinePageImport = false

  for (const stmt of ast.body) {
    if (stmt.type === 'ImportDeclaration') {
      for (const spec of stmt.specifiers || []) {
        if (spec.local && spec.local.name === 'definePage') {
          hasDefinePageImport = true
        }
      }
    }
  }

  const targetExports = []

  for (const stmt of ast.body) {
    if (stmt.type === 'ExportNamedDeclaration') {
      if (stmt.declaration) {
        if (stmt.declaration.type === 'VariableDeclaration') {
          for (const decl of stmt.declaration.declarations) {
            if (decl.id && decl.id.type === 'Identifier') {
              const name = decl.id.name
              if (name === 'paths' || name === 'server') {
                const initCode = decl.init ? scriptContent.slice(decl.init.range[0], decl.init.range[1]) : 'null'
                targetExports.push({
                  key: name,
                  stmtNode: stmt,
                  declNode: decl,
                  initCode
                })
              }
            }
          }
        } else if (stmt.declaration.type === 'FunctionDeclaration') {
          const fn = stmt.declaration
          if (fn.id && (fn.id.name === 'paths' || fn.id.name === 'server')) {
            const name = fn.id.name
            const asyncPrefix = fn.async ? 'async ' : ''
            let paramsCode = ''
            if (fn.params && fn.params.length > 0) {
              paramsCode = scriptContent.slice(fn.params[0].range[0], fn.params[fn.params.length - 1].range[1])
            }
            const bodyCode = scriptContent.slice(fn.body.range[0], fn.body.range[1])
            const initCode = `${asyncPrefix}function (${paramsCode}) ${bodyCode}`
            targetExports.push({
              key: name,
              stmtNode: stmt,
              declNode: fn,
              initCode
            })
          }
        }
      }
    }
  }

  if (targetExports.length === 0) {
    return {
      code: scriptContent,
      modified: false
    }
  }

  const orderedExports = [...targetExports].sort((a) => (a.key === 'paths' ? -1 : 1))

  const propBlocks = []
  for (let i = 0; i < orderedExports.length; i++) {
    const exp = orderedExports[i]
    const isLast = i === orderedExports.length - 1
    const comma = isLast ? '' : ','
    const propInitFormatted = formatPropertyInit(exp.initCode, '  ', '    ')
    propBlocks.push(`    ${exp.key}: ${propInitFormatted}${comma}`)
  }

  const definePageBlock = `export default definePage({\n${propBlocks.join('\n')}\n  })`

  const distinctStmts = []
  const seenStmtNodes = new Set()
  for (const exp of targetExports) {
    if (!seenStmtNodes.has(exp.stmtNode)) {
      seenStmtNodes.add(exp.stmtNode)
      distinctStmts.push(exp.stmtNode)
    }
  }
  distinctStmts.sort((a, b) => a.range[0] - b.range[0])

  let nextCode = scriptContent

  for (let i = distinctStmts.length - 1; i >= 0; i--) {
    const stmtNode = distinctStmts[i]
    const isLastStmt = i === distinctStmts.length - 1

    let removeStart = stmtNode.range[0]
    let removeEnd = stmtNode.range[1]

    const lineStart = nextCode.lastIndexOf('\n', removeStart - 1)
    if (lineStart !== -1) {
      const prefix = nextCode.slice(lineStart + 1, removeStart)
      if (/^\s*$/.test(prefix)) {
        removeStart = lineStart + 1
      }
    }

    if (nextCode.slice(removeEnd, removeEnd + 1) === '\n') {
      removeEnd++
    }

    if (isLastStmt) {
      nextCode = nextCode.slice(0, removeStart) + '  ' + definePageBlock + nextCode.slice(stmtNode.range[1])
    } else {
      if (nextCode.slice(removeEnd).startsWith('\n')) {
        removeEnd++
      }
      nextCode = nextCode.slice(0, removeStart) + nextCode.slice(removeEnd)
    }
  }

  if (!hasDefinePageImport) {
    try {
      const reAst = parseJS(nextCode, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ranges: true
      })

      let reFirstImport = null
      for (const s of reAst.body) {
        if (s.type === 'ImportDeclaration') {
          reFirstImport = s
          break
        }
      }

      if (reFirstImport) {
        let importStart = reFirstImport.range[0]
        const lineStart = nextCode.lastIndexOf('\n', importStart - 1)
        if (lineStart !== -1) {
          const prefix = nextCode.slice(lineStart + 1, importStart)
          if (/^\s*$/.test(prefix)) {
            importStart = lineStart + 1
          }
        }
        const importDecl = "  import { definePage } from 'coralite'\n"
        nextCode = nextCode.slice(0, importStart) + importDecl + nextCode.slice(importStart)
      } else {
        let insertPos = 0
        if (nextCode.startsWith('\n')) {
          insertPos = 1
        }
        const importDecl = "  import { definePage } from 'coralite'\n\n"
        nextCode = nextCode.slice(0, insertPos) + importDecl + nextCode.slice(insertPos)
      }
    } catch {
      let insertPos = 0
      if (nextCode.startsWith('\n')) {
        insertPos = 1
      }
      const importDecl = "  import { definePage } from 'coralite'\n\n"
      nextCode = nextCode.slice(0, insertPos) + importDecl + nextCode.slice(insertPos)
    }
  }

  return {
    code: nextCode,
    modified: nextCode !== scriptContent
  }
}

/**
 * Applies deterministic AST auto-fixes for page bare exports (CORALITE-E108).
 *
 * @param {string} sourceCode - Raw page file content
 * @param {Array<import('../../types/index.js').CoraliteDiagnostic>} [diagnostics=null] - Pre-computed diagnostics
 * @param {Object} [options={}] - Options (filePath, dryRun)
 * @returns {{ outputCode: string, modified: boolean, fixesApplied: Array<Object>, diff: string }} Fix result
 */
export function applyPageFixes (sourceCode, diagnostics = null, options = {}) {
  const filePath = options.filePath || ''

  if (sourceCode.includes('<!-- coralite-ignore E108 -->')) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      diff: ''
    }
  }

  if (filePath && (filePath.includes('tests/fixtures/') || filePath.includes('tests\\fixtures\\')) && !filePath.includes('codemod')) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      diff: ''
    }
  }

  const effectiveDiagnostics = diagnostics || validatePageSource(sourceCode, { filePath }).diagnostics
  const fixableDiagnostics = effectiveDiagnostics.filter(d => d.code === 'CORALITE-E108' && d.fix?.action === 'migrate_bare_exports')

  if (fixableDiagnostics.length === 0) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      diff: ''
    }
  }

  const moduleScriptRegex = /<script\b(?=[^>]*\btype=["']?module["']?)(?:[^>]*>)([\s\S]*?)<\/script>/gi
  const scriptMatch = moduleScriptRegex.exec(sourceCode)

  if (!scriptMatch) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      diff: ''
    }
  }

  const scriptContent = scriptMatch[1]
  const scriptStart = scriptMatch.index + scriptMatch[0].indexOf(scriptContent)
  const scriptEnd = scriptStart + scriptContent.length

  const { code: newScriptContent, modified } = transformScriptBareExports(scriptContent)

  if (!modified) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      diff: ''
    }
  }

  const outputCode = sourceCode.slice(0, scriptStart) + newScriptContent + sourceCode.slice(scriptEnd)
  const fixesApplied = [{
    code: 'CORALITE-E108',
    description: 'Convert bare exports to definePage({ ... })'
  }]

  const diff = generateColorizedDiff(sourceCode, outputCode, filePath)

  return {
    outputCode,
    modified: true,
    fixesApplied,
    diff
  }
}
