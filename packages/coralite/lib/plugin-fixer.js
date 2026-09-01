import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import { validatePluginSource } from './plugin-validator.js'
import { generateColorizedDiff } from './component-fixer.js'

export { generateColorizedDiff }

/**
 * @import { CoraliteDiagnostic } from '../types/index.js'
 */

function getPropKeyName (propNode) {
  if (!propNode || propNode.type !== 'Property') {
    return null
  }
  if (!propNode.computed) {
    if (propNode.key.type === 'Identifier') {
      return propNode.key.name
    }
    if (propNode.key.type === 'Literal') {
      return String(propNode.key.value)
    }
  } else if (propNode.key.type === 'Literal') {
    return String(propNode.key.value)
  }
  return null
}

function isTwoPhaseCurried (fnNode) {
  if (!fnNode || (fnNode.type !== 'FunctionExpression' && fnNode.type !== 'ArrowFunctionExpression')) {
    return false
  }

  if (fnNode.body.type === 'FunctionExpression' || fnNode.body.type === 'ArrowFunctionExpression') {
    return true
  }

  if (fnNode.body.type === 'BlockStatement') {
    let returnsFunction = false
    walkJS(fnNode.body, {
      ReturnStatement (retNode) {
        if (retNode.argument && (retNode.argument.type === 'FunctionExpression' || retNode.argument.type === 'ArrowFunctionExpression')) {
          returnsFunction = true
        }
      }
    })
    return returnsFunction
  }

  return false
}

/**
 * Applies deterministic AST auto-fixes for Two-Phase context currying (CORALITE-P201)
 * and definePlugin wrapping with import injection (CORALITE-P401).
 *
 * @param {string} sourceCode - Raw plugin source code
 * @param {Array<CoraliteDiagnostic>} [diagnostics=null] - Pre-computed diagnostics
 * @param {Object} [options={}] - Options (filePath, dryRun)
 * @returns {{ outputCode: string, modified: boolean, fixesApplied: Array<{ code: string, description: string }>, diff: string }} Fix result
 */
export function applyPluginFixes (sourceCode, diagnostics = null, options = {}) {
  const filePath = options.filePath || ''

  if (!diagnostics) {
    const report = validatePluginSource(sourceCode, filePath)
    diagnostics = report.diagnostics
  }

  let code = sourceCode
  const fixesApplied = []

  const fixableDiagnostics = diagnostics.filter(d => Boolean(d.fix))

  if (fixableDiagnostics.length === 0) {
    return {
      outputCode: sourceCode,
      modified: false,
      fixesApplied: [],
      diff: ''
    }
  }

  // --- STAGE 1: AST-based Transformations ---
  try {
    let ast = parseJS(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      ranges: true
    })

    // 1.1 CORALITE-P201 (Wrap Context into Two-Phase Curried Function)
    const p201Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-P201' && d.fix?.action === 'wrap_two_phase_context')
    if (p201Diagnostics.length > 0) {
      /** @type {Array<{ start: number, end: number, replacement: string }>} */
      const replacements = []

      walkAncestorJS(ast, {
        Property (node) {
          const keyName = getPropKeyName(node)
          if (keyName === 'context' && node.value && node.value.range) {
            const valNode = node.value
            if (
              (valNode.type === 'ArrowFunctionExpression' || valNode.type === 'FunctionExpression') &&
              !isTwoPhaseCurried(valNode)
            ) {
              const paramName = (valNode.params && valNode.params.length > 0 && valNode.params[0].type === 'Identifier')
                ? valNode.params[0].name
                : 'pluginContext'

              const [valStart, valEnd] = valNode.range
              const origValCode = code.slice(valStart, valEnd)

              let newValCode = origValCode
              if (valNode.body.type === 'BlockStatement') {
                const bodyStart = valNode.body.range[0]
                const fnBody = origValCode.slice(bodyStart - valStart)
                newValCode = `(${paramName}) => (instanceContext) => ${fnBody}`
              } else {
                const arrowIdx = origValCode.indexOf('=>')
                if (arrowIdx !== -1) {
                  const exprBody = origValCode.slice(arrowIdx + 2).trim()
                  newValCode = `(${paramName}) => (instanceContext) => ${exprBody}`
                }
              }

              if (newValCode !== origValCode) {
                replacements.push({
                  start: valStart,
                  end: valEnd,
                  replacement: newValCode
                })
                fixesApplied.push({
                  code: 'CORALITE-P201',
                  description: 'Wrap context into Two-Phase curried function'
                })
              }
            }
          }
        }
      })

      // Apply replacements in reverse order of position
      replacements.sort((a, b) => b.start - a.start)
      for (const rep of replacements) {
        code = code.slice(0, rep.start) + rep.replacement + code.slice(rep.end)
      }

      // Re-parse AST after P201 fixes
      ast = parseJS(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        ranges: true
      })
    }

    // 1.2 CORALITE-P401 (Wrap Return Object in definePlugin and Inject Import if missing)
    const p401Diagnostics = diagnostics.filter(d => (d.code === 'CORALITE-P401' || d.code === 'NO_DEFINE_PLUGIN_CALL') && d.fix?.action === 'wrap_define_plugin')
    if (p401Diagnostics.length > 0) {
      let exportNode = null
      for (const stmt of ast.body) {
        if (stmt.type === 'ExportDefaultDeclaration') {
          exportNode = stmt
          break
        }
      }

      if (exportNode) {
        const decl = exportNode.declaration
        let targetObjNode = null

        if (decl.type === 'ObjectExpression') {
          targetObjNode = decl
        } else if (decl.type === 'FunctionDeclaration' || decl.type === 'FunctionExpression' || decl.type === 'ArrowFunctionExpression') {
          if (decl.body) {
            walkAncestorJS(decl.body, {
              ReturnStatement (retNode) {
                if (retNode.argument && retNode.argument.type === 'ObjectExpression') {
                  targetObjNode = retNode.argument
                }
              }
            })
          }
        }

        if (targetObjNode && targetObjNode.range) {
          const [objStart, objEnd] = targetObjNode.range
          const rawObjCode = code.slice(objStart, objEnd)
          const wrappedCode = `definePlugin(${rawObjCode})`

          /** @type {Array<{ start: number, end: number, replacement: string }>} */
          const p401Replacements = [
            {
              start: objStart,
              end: objEnd,
              replacement: wrappedCode
            }
          ]

          fixesApplied.push({
            code: 'CORALITE-P401',
            description: 'Wrap returned object in definePlugin()'
          })

          /** @type {any[]} */
          const coraliteImports = ast.body.filter(
            stmt => stmt.type === 'ImportDeclaration' && stmt.source && stmt.source.value === 'coralite'
          )

          const hasDefinePlugin = coraliteImports.some(imp => {
            return imp.specifiers && imp.specifiers.some(
              s => (s.type === 'ImportSpecifier' && s.imported && s.imported.name === 'definePlugin') ||
                   (s.local && s.local.name === 'definePlugin')
            )
          })

          if (!hasDefinePlugin) {
            const namedImportNode = coraliteImports.find(imp => {
              return imp.specifiers && imp.specifiers.length > 0 &&
                imp.specifiers.every(s => s.type === 'ImportSpecifier')
            })

            if (namedImportNode && namedImportNode.range) {
              const specifiers = namedImportNode.specifiers.map(s => {
                return s.imported && s.imported.name !== s.local.name
                  ? `${s.imported.name} as ${s.local.name}`
                  : s.local.name
              })
              specifiers.push('definePlugin')
              p401Replacements.push({
                start: namedImportNode.range[0],
                end: namedImportNode.range[1],
                replacement: `import { ${specifiers.join(', ')} } from 'coralite'`
              })
            } else {
              p401Replacements.push({
                start: 0,
                end: 0,
                replacement: "import { definePlugin } from 'coralite'\n"
              })
            }
          }

          p401Replacements.sort((a, b) => b.start - a.start)
          for (const rep of p401Replacements) {
            code = code.slice(0, rep.start) + rep.replacement + code.slice(rep.end)
          }
        }
      }
    }
  } catch {
    // AST transform fallback
  }

  const modified = code !== sourceCode
  const diff = modified ? generateColorizedDiff(sourceCode, code, filePath) : ''

  return {
    outputCode: code,
    modified,
    fixesApplied,
    diff
  }
}
