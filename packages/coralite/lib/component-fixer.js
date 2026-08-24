import { Parser } from 'htmlparser2'
import { parse as parseJS } from 'acorn'
import { ancestor as walkAncestorJS } from 'acorn-walk'
import kleur from 'kleur'
import { validateComponentSource } from './component-validator.js'
import { kebabToCamel, camelToKebab } from './utils/core.js'

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

function isSemanticMatch (el, strippedRef) {
  const rLower = strippedRef.toLowerCase()
  const rCamel = kebabToCamel(strippedRef)
  const rKebab = camelToKebab(strippedRef)

  if (el.id && (el.id === strippedRef || el.id.toLowerCase() === rLower || kebabToCamel(el.id) === rCamel)) {
    return true
  }

  if (el.className) {
    const classes = el.className.split(/\s+/)
    if (classes.some(c => c === strippedRef || c.toLowerCase() === rLower || kebabToCamel(c) === rCamel)) {
      return true
    }
  }

  const tag = el.tagName.toLowerCase()
  if (tag === rLower || tag === rKebab) {
    return true
  }

  if (tag === 'button' && (rLower === 'btn' || rLower === 'button' || rLower.endsWith('-btn') || rLower.endsWith('_btn') || rLower.endsWith('button') || rLower.includes('btn'))) {
    return true
  }

  if (tag === 'input' && (rLower.endsWith('-input') || rLower.endsWith('_input') || rLower.includes('input'))) {
    return true
  }

  return false
}

/**
 * Generates a colorized unified diff between old code and new code using kleur.
 *
 * @param {string} oldCode - Original source code string
 * @param {string} newCode - Modified source code string
 * @param {string} [filePath=''] - Path of the file being diffed
 * @returns {string} Colorized diff output string
 */
export function generateColorizedDiff (oldCode, newCode, filePath = '') {
  if (oldCode === newCode) {
    return ''
  }

  const oldLines = oldCode.split('\n')
  const newLines = newCode.split('\n')

  let diffOutput = ''
  if (filePath) {
    diffOutput += kleur.bold(`[DRY-RUN PREVIEW] ${filePath}`) + '\n'
    diffOutput += kleur.gray('─'.repeat(60)) + '\n'
  }

  let i = 0
  let j = 0
  const changes = []

  const N = oldLines.length
  const M = newLines.length

  if (N < 2000 && M < 2000) {
    const dp = Array.from({ length: N + 1 }, () => new Int32Array(M + 1))
    for (let x = N - 1; x >= 0; x--) {
      for (let y = M - 1; y >= 0; y--) {
        if (oldLines[x] === newLines[y]) {
          dp[x][y] = dp[x + 1][y + 1] + 1
        } else {
          dp[x][y] = Math.max(dp[x + 1][y], dp[x][y + 1])
        }
      }
    }

    xLoop: while (i < N || j < M) {
      if (i < N && j < M && oldLines[i] === newLines[j]) {
        changes.push({
          type: 'same',
          line: oldLines[i],
          oldLineNum: i + 1,
          newLineNum: j + 1
        })
        i++
        j++
      } else if (i < N && (j === M || dp[i + 1][j] >= dp[i][j + 1])) {
        changes.push({
          type: 'del',
          line: oldLines[i],
          oldLineNum: i + 1
        })
        i++
      } else if (j < M) {
        changes.push({
          type: 'add',
          line: newLines[j],
          newLineNum: j + 1
        })
        j++
      } else {
        break xLoop
      }
    }
  } else {
    for (let k = 0; k < Math.max(N, M); k++) {
      if (k < N && k < M) {
        if (oldLines[k] === newLines[k]) {
          changes.push({
            type: 'same',
            line: oldLines[k],
            oldLineNum: k + 1,
            newLineNum: k + 1
          })
        } else {
          changes.push({
            type: 'del',
            line: oldLines[k],
            oldLineNum: k + 1
          })
          changes.push({
            type: 'add',
            line: newLines[k],
            newLineNum: k + 1
          })
        }
      } else if (k < N) {
        changes.push({
          type: 'del',
          line: oldLines[k],
          oldLineNum: k + 1
        })
      } else {
        changes.push({
          type: 'add',
          line: newLines[k],
          newLineNum: k + 1
        })
      }
    }
  }

  const contextSize = 3
  const isChanged = (idx) => changes[idx] && changes[idx].type !== 'same'

  let inHunk = false
  for (let k = 0; k < changes.length; k++) {
    const show = isChanged(k) ||
      Array.from({ length: (contextSize * 2) + 1 }, (_, offset) => (k - contextSize) + offset)
        .some(idx => idx >= 0 && idx < changes.length && isChanged(idx))

    if (show) {
      if (!inHunk && k > 0) {
        diffOutput += kleur.gray('@@ ... @@') + '\n'
      }
      inHunk = true
      const item = changes[k]
      if (item.type === 'same') {
        diffOutput += kleur.gray('  ' + item.line) + '\n'
      } else if (item.type === 'del') {
        diffOutput += kleur.red('- ' + item.line) + '\n'
      } else if (item.type === 'add') {
        diffOutput += kleur.green('+ ' + item.line) + '\n'
      }
    } else {
      inHunk = false
    }
  }

  return diffOutput
}

/**
 * Applies deterministic AST auto-fixes for template expression lifting (CORALITE-E201),
 * usage-aware client dynamic import rewriting (CORALITE-E301), single-candidate ref injection (CORALITE-E202),
 * attribute default mutex resolution (CORALITE-E102), and inline event listener removal (CORALITE-E203).
 *
 * @param {string} sourceCode - Raw component file content
 * @param {Array<CoraliteDiagnostic>} [diagnostics=null] - Pre-computed diagnostics
 * @param {Object} [options={}] - Options (filePath, dryRun)
 * @returns {{ outputCode: string, modified: boolean, fixesApplied: Array<Object>, diff: string }} Fix result
 */
export function applyComponentFixes (sourceCode, diagnostics = null, options = {}) {
  const filePath = options.filePath || ''

  if (!diagnostics) {
    const report = validateComponentSource(sourceCode, filePath)
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

  // --- STAGE 1: Template AST & String Transformations ---
  const gettersToInject = []

  // 1.1 CORALITE-E201 (Template Expression Lifting)
  const e201Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-E201' && d.fix)
  for (const diag of e201Diagnostics) {
    const getterInfo = diag.fix.getter
    if (!getterInfo) {
      continue
    }

    const matchMsg = diag.message.match(/Inline expression '\{\{\s*(.+?)\s*\}\}'/)
    const rawExpr = matchMsg ? matchMsg[1] : null

    if (rawExpr) {
      const escapedExpr = rawExpr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const mustacheRegex = new RegExp(`\\{\\{\\s*${escapedExpr}\\s*\\}\\}`, 'g')

      if (mustacheRegex.test(code)) {
        code = code.replace(mustacheRegex, diag.fix.replacement || `{{ ${getterInfo.name} }}`)
        gettersToInject.push(getterInfo)
        fixesApplied.push({
          code: 'CORALITE-E201',
          description: diag.fix.description || `Lift expression to getter '${getterInfo.name}'`
        })
      }
    }
  }

  // 1.2 CORALITE-E202 (Single-Candidate Ref Injection)
  const e202Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-E202' && d.fix?.action === 'inject_ref')
  for (const diag of e202Diagnostics) {
    const matchMsg = diag.message.match(/Missing ref "([^"]+)"/)
    const strippedRef = matchMsg ? matchMsg[1] : null

    if (!strippedRef) {
      continue
    }

    const templateElements = []
    let currentSection = null
    let templateDepth = 0

    const parser = new Parser(
      {
        onopentag (name, attribs) {
          const lowerName = name.toLowerCase()
          if (currentSection === null) {
            if (lowerName === 'template') {
              currentSection = 'template'
              templateDepth = 1
            }
          } else if (currentSection === 'template') {
            if (lowerName === 'template') {
              templateDepth++
            } else {
              templateElements.push({
                tagName: lowerName,
                id: attribs?.id ? String(attribs.id).trim() : null,
                className: attribs?.class ? String(attribs.class).trim() : null,
                rawAttribs: attribs
              })
            }
          }
        },
        onclosetag (name) {
          if (currentSection === 'template') {
            if (name.toLowerCase() === 'template') {
              templateDepth--
              if (templateDepth === 0) {
                currentSection = null
              }
            }
          }
        }
      },
      {
        lowerCaseTags: true,
        lowerCaseAttributeNames: true
      }
    )

    parser.write(code)
    parser.end()

    let candidates = templateElements.filter(el => isSemanticMatch(el, strippedRef))
    if (candidates.length === 0) {
      const interactive = templateElements.filter(el => ['button', 'input', 'form', 'a', 'select', 'textarea'].includes(el.tagName))
      if (interactive.length > 0) {
        candidates = interactive
      } else {
        candidates = templateElements
      }
    }

    if (candidates.length === 1) {
      const candidateTag = candidates[0].tagName
      const templateMatch = /<template[\s\S]*?>([\s\S]*?)<\/template>/i.exec(code)
      if (templateMatch) {
        const templateContent = templateMatch[1]
        const templateOffset = templateMatch.index + templateMatch[0].indexOf(templateContent)
        const tagRegex = new RegExp(`<(${candidateTag})([\\s>\\/])`, 'i')
        const tagMatch = tagRegex.exec(templateContent)
        if (tagMatch) {
          const insertPos = templateOffset + tagMatch.index + 1 + candidateTag.length
          code = code.slice(0, insertPos) + ` ref="${strippedRef}"` + code.slice(insertPos)
          fixesApplied.push({
            code: 'CORALITE-E202',
            description: diag.fix.description || `Add ref="${strippedRef}" to matching <${candidateTag}> element`
          })
        }
      } else {
        const tagRegex = new RegExp(`<(${candidateTag})([\\s>\\/])`, 'i')
        const tagMatch = tagRegex.exec(code)
        if (tagMatch) {
          const insertPos = tagMatch.index + 1 + candidateTag.length
          code = code.slice(0, insertPos) + ` ref="${strippedRef}"` + code.slice(insertPos)
          fixesApplied.push({
            code: 'CORALITE-E202',
            description: diag.fix.description || `Add ref="${strippedRef}" to matching <${candidateTag}> element`
          })
        }
      }
    }
  }

  // 1.3 CORALITE-E203 (Inline Event Listener Removal)
  const e203Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-E203' && d.fix?.action === 'remove_attribute')
  if (e203Diagnostics.length > 0) {
    if (code.includes('<template')) {
      const templateMatch = /<template[\s\S]*?>([\s\S]*?)<\/template>/i.exec(code)
      if (templateMatch) {
        let templateContent = templateMatch[1]
        const templateStart = templateMatch.index + templateMatch[0].indexOf(templateContent)
        let templateModified = false

        for (const diag of e203Diagnostics) {
          const matchMsg = diag.message.match(/attribute '([^']+)'/)
          const attrName = matchMsg ? matchMsg[1] : null

          if (attrName) {
            const attrRegex = new RegExp(`\\s+${attrName}=(?:"[^"]*"|'[^']*'|\\S+)`, 'gi')
            if (attrRegex.test(templateContent)) {
              templateContent = templateContent.replace(attrRegex, '')
              templateModified = true
              fixesApplied.push({
                code: 'CORALITE-E203',
                description: diag.fix.description || `Remove inline ${attrName} attribute`
              })
            }
          }
        }

        if (templateModified) {
          code = code.slice(0, templateStart) + templateContent + code.slice(templateStart + templateMatch[1].length)
        }
      }
    } else {
      for (const diag of e203Diagnostics) {
        const matchMsg = diag.message.match(/attribute '([^']+)'/)
        const attrName = matchMsg ? matchMsg[1] : null

        if (attrName) {
          const attrRegex = new RegExp(`\\s+${attrName}=(?:"[^"]*"|'[^']*'|\\S+)`, 'gi')
          if (attrRegex.test(code)) {
            code = code.replace(attrRegex, '')
            fixesApplied.push({
              code: 'CORALITE-E203',
              description: diag.fix.description || `Remove inline ${attrName} attribute`
            })
          }
        }
      }
    }
  }

  // --- STAGE 2: Script AST Transformations ---
  let scriptContent = ''
  let scriptStart = 0
  let scriptLength = 0
  let isHtmlFile = false

  if (code.includes('<script')) {
    const scriptMatch = /<script[\s\S]*?>([\s\S]*?)<\/script>/i.exec(code)
    if (scriptMatch) {
      isHtmlFile = true
      scriptContent = scriptMatch[1]
      scriptLength = scriptMatch[1].length
      scriptStart = scriptMatch.index + scriptMatch[0].indexOf(scriptMatch[1])
    }
  } else {
    scriptContent = code
  }

  if (scriptContent.trim()) {
    try {
      /** @type {any} */
      let ast = parseJS(scriptContent, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        ranges: true
      })

      // 2.1 CORALITE-E102 (Attribute Mutex Resolution: strip default when required: true)
      const e102Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-E102')
      if (e102Diagnostics.length > 0) {
        walkAncestorJS(ast, {
          CallExpression (node) {
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'defineComponent' &&
              node.arguments.length > 0 &&
              node.arguments[0].type === 'ObjectExpression'
            ) {
              const configObj = node.arguments[0]
              const attrProp = configObj.properties.find(p => getPropKeyName(p) === 'attributes')

              if (attrProp && attrProp.type === 'Property' && attrProp.value.type === 'ObjectExpression') {
                for (const prop of attrProp.value.properties) {
                  if (prop.type === 'Property' && prop.value.type === 'ObjectExpression') {
                    const attrProps = prop.value.properties
                    const reqProp = attrProps.find(p => p.type === 'Property' && getPropKeyName(p) === 'required' && (p.value.type === 'Literal' ? (p.value.value === true || p.value.value === 'true') : (p.value.type === 'Identifier' && p.value.name === 'true')))
                    const defProp = attrProps.find(p => p.type === 'Property' && getPropKeyName(p) === 'default')

                    if (reqProp && defProp && defProp.range) {
                      const [defStart, defEnd] = defProp.range
                      let removeStart = defStart
                      let removeEnd = defEnd

                      if (scriptContent.slice(removeEnd, removeEnd + 1) === ',') {
                        removeEnd++
                      } else {
                        const before = scriptContent.slice(0, removeStart)
                        const lastComma = before.lastIndexOf(',')
                        if (lastComma !== -1) {
                          removeStart = lastComma
                        }
                      }

                      scriptContent = scriptContent.slice(0, removeStart) + scriptContent.slice(removeEnd)
                      fixesApplied.push({
                        code: 'CORALITE-E102',
                        description: 'Remove default value when required: true is set'
                      })
                    }
                  }
                }
              }
            }
          }
        })

        ast = parseJS(scriptContent, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true,
          ranges: true
        })
      }

      // 2.2 CORALITE-E201 (Getter Injection into defineComponent)
      if (gettersToInject.length > 0) {
        let injectedAny = false
        walkAncestorJS(ast, {
          CallExpression (node) {
            if (
              !injectedAny &&
              node.callee.type === 'Identifier' &&
              node.callee.name === 'defineComponent' &&
              node.arguments.length > 0 &&
              node.arguments[0].type === 'ObjectExpression'
            ) {
              const configObj = node.arguments[0]
              const gettersProp = configObj.properties.find(p => getPropKeyName(p) === 'getters')

              if (gettersProp && gettersProp.type === 'Property' && gettersProp.value.type === 'ObjectExpression') {
                const gettersObj = gettersProp.value
                const closeBraceIdx = gettersObj.range[1] - 1
                const hasExisting = gettersObj.properties.length > 0

                const newGetterCodes = gettersToInject.map(g => g.code).join(',\n    ')
                const insertion = hasExisting
                  ? `,\n    ${newGetterCodes}`
                  : `\n    ${newGetterCodes}\n  `

                scriptContent = scriptContent.slice(0, closeBraceIdx) + insertion + scriptContent.slice(closeBraceIdx)
                injectedAny = true
              } else {
                const insertionIdx = configObj.range[0] + 1
                const newGetterCodes = gettersToInject.map(g => g.code).join(',\n    ')
                const gettersBlock = `\n  getters: {\n    ${newGetterCodes}\n  },`

                scriptContent = scriptContent.slice(0, insertionIdx) + gettersBlock + scriptContent.slice(insertionIdx)
                injectedAny = true
              }
            }
          }
        })

        ast = parseJS(scriptContent, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true,
          ranges: true
        })
      }

      // 2.3 CORALITE-E301 (Smart Client Dynamic Import Rewrite)
      const e301Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-E301' && d.fix?.action === 'dynamic_import')
      if (e301Diagnostics.length > 0) {
        const targetSymbols = new Set()
        const sharedSymbols = new Set()
        for (const diag of e301Diagnostics) {
          const m = diag.message.match(/Top-level import '([^']+)'/)
          if (m) {
            targetSymbols.add(m[1])
            if (diag.fix?.isSharedWithOtherBlocks) {
              sharedSymbols.add(m[1])
            }
          }
        }

        const importDecls = []
        for (const stmt of ast.body) {
          if (stmt.type === 'ImportDeclaration') {
            importDecls.push(stmt)
          }
        }

        const dynamicImportInjections = []
        // { start, end, newStr }
        const importReplacements = []

        for (const impNode of importDecls) {
          const sourcePkg = impNode.source.value
          const specifiersToMove = []
          const specifiersToKeep = []

          for (const spec of impNode.specifiers || []) {
            const localName = spec.local.name
            if (targetSymbols.has(localName)) {
              const isDefault = spec.type === 'ImportDefaultSpecifier'
              const isNamespace = spec.type === 'ImportNamespaceSpecifier'
              const importedName = spec.type === 'ImportSpecifier' && spec.imported && spec.imported.type === 'Identifier' ? spec.imported.name : localName
              specifiersToMove.push({
                localName,
                isDefault,
                isNamespace,
                importedName
              })

              if (sharedSymbols.has(localName)) {
                specifiersToKeep.push(spec)
              }
            } else {
              specifiersToKeep.push(spec)
            }
          }

          if (specifiersToMove.length > 0) {
            dynamicImportInjections.push({
              source: sourcePkg,
              specifiers: specifiersToMove
            })

            const [start, end] = impNode.range
            if (specifiersToKeep.length === 0) {
              let lineEnd = end
              if (scriptContent.slice(end, end + 1) === '\n') {
                lineEnd++
              }
              importReplacements.push({
                start,
                end: lineEnd,
                newStr: ''
              })
            } else {
              const keptCode = specifiersToKeep.map(s => {
                if (s.type === 'ImportDefaultSpecifier') {
                  return s.local.name
                }
                if (s.type === 'ImportNamespaceSpecifier') {
                  return `* as ${s.local.name}`
                }
                const impName = s.imported && s.imported.type === 'Identifier' ? s.imported.name : s.local.name
                return impName !== s.local.name ? `${impName} as ${s.local.name}` : s.local.name
              })

              const hasDefault = specifiersToKeep.some(s => s.type === 'ImportDefaultSpecifier')
              const hasNamespace = specifiersToKeep.some(s => s.type === 'ImportNamespaceSpecifier')

              let newImportStr = ''
              if (hasDefault || hasNamespace) {
                newImportStr = `import ${keptCode.join(', ')} from '${sourcePkg}'`
              } else {
                newImportStr = `import { ${keptCode.join(', ')} } from '${sourcePkg}'`
              }

              importReplacements.push({
                start,
                end,
                newStr: newImportStr
              })
            }
          }
        }

        // Apply top-level import replacements in reverse range order
        importReplacements.sort((a, b) => b.start - a.start)
        for (const rep of importReplacements) {
          scriptContent = scriptContent.slice(0, rep.start) + rep.newStr + scriptContent.slice(rep.end)
        }

        ast = parseJS(scriptContent, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true,
          ranges: true
        })

        const importStatements = []
        for (const item of dynamicImportInjections) {
          const { source, specifiers } = item
          const defaultSpec = specifiers.find(s => s.isDefault)
          const namespaceSpec = specifiers.find(s => s.isNamespace)
          const namedSpecs = specifiers.filter(s => !s.isDefault && !s.isNamespace)

          if (namespaceSpec) {
            importStatements.push(`const ${namespaceSpec.localName} = await import('${source}')`)
          } else {
            const parts = []
            if (defaultSpec) {
              parts.push(`default: ${defaultSpec.localName}`)
            }
            for (const nSpec of namedSpecs) {
              parts.push(nSpec.importedName !== nSpec.localName ? `${nSpec.importedName}: ${nSpec.localName}` : nSpec.localName)
            }
            importStatements.push(`const { ${parts.join(', ')} } = await import('${source}')`)
          }
        }

        walkAncestorJS(ast, {
          CallExpression (node) {
            if (
              node.callee.type === 'Identifier' &&
              node.callee.name === 'defineComponent' &&
              node.arguments.length > 0 &&
              node.arguments[0].type === 'ObjectExpression'
            ) {
              const configObj = node.arguments[0]
              const clientProp = configObj.properties.find(p => getPropKeyName(p) === 'client')

              if (clientProp && clientProp.type === 'Property') {
                const fnVal = clientProp.value
                if (fnVal.type === 'FunctionExpression' || fnVal.type === 'ArrowFunctionExpression') {
                  const fnBodyStart = fnVal.body.range[0] + 1
                  const injection = '\n    ' + importStatements.join('\n    ')

                  scriptContent = scriptContent.slice(0, fnBodyStart) + injection + scriptContent.slice(fnBodyStart)

                  if (!fnVal.async) {
                    const clientStart = clientProp.range[0]
                    const clientSubstr = scriptContent.slice(clientStart, fnVal.body.range[0])
                    let asyncSubstr = clientSubstr
                    if (clientSubstr.includes('client(')) {
                      asyncSubstr = clientSubstr.replace('client(', 'async client(')
                    } else if (clientSubstr.includes('client:')) {
                      asyncSubstr = clientSubstr.replace('client:', 'client: async')
                    } else {
                      asyncSubstr = 'async ' + clientSubstr
                    }
                    scriptContent = scriptContent.slice(0, clientStart) + asyncSubstr + scriptContent.slice(fnVal.body.range[0])
                  }

                  for (const sym of targetSymbols) {
                    fixesApplied.push({
                      code: 'CORALITE-E301',
                      description: `Convert top-level import '${sym}' to dynamic import in client()`
                    })
                  }
                }
              }
            }
          }
        })
      }

      if (isHtmlFile) {
        code = code.slice(0, scriptStart) + scriptContent + code.slice(scriptStart + scriptLength)
      } else {
        code = scriptContent
      }
    } catch {
      // AST transform fallback
    }
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
