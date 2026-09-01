import { Parser } from 'htmlparser2'
import { parse as parseJS } from 'acorn'
import { ancestor as walkAncestorJS } from 'acorn-walk'
import kleur from 'kleur'
import { validateComponentSource } from './component-validator.js'
import { kebabToCamel, camelToKebab } from './utils/core.js'

const INTERACTIVE_TAGS = new Set(['button', 'input', 'form', 'a', 'select', 'textarea'])

/**
 * Case-insensitive search on raw string without length-expanding lowercasing side-effects.
 * @param {string} str - Source string
 * @param {string} needle - Substring to find
 * @param {number} [from=0] - Search start index
 * @returns {number} Index of match or -1
 */
function indexOfCI (str, needle, from = 0) {
  const nLow = needle.toLowerCase()
  const n0 = nLow[0]
  const limit = str.length - needle.length
  for (let i = from; i <= limit; i++) {
    if (str[i].toLowerCase() === n0 && str.slice(i, i + needle.length).toLowerCase() === nLow) {
      return i
    }
  }
  return -1
}

/**
 * Deterministically extracts the first <template> block's inner content and its byte offsets in linear O(n) time.
 * @param {string} [sourceCode] - Component source code
 * @returns {{ content: string, start: number, end: number } | null} Template block info or null if not found
 */
function extractTemplateBlock (sourceCode) {
  if (!sourceCode || typeof sourceCode !== 'string') {
    return null
  }

  let searchFrom = 0
  while (searchFrom <= sourceCode.length - 9) {
    const openTagStart = indexOfCI(sourceCode, '<template', searchFrom)
    if (openTagStart === -1) {
      return null
    }

    const charAfter = sourceCode[openTagStart + 9]
    if (charAfter !== undefined && charAfter !== '>' && charAfter !== '/' && !/\s/.test(charAfter)) {
      searchFrom = openTagStart + 9
      continue
    }

    const openTagEnd = sourceCode.indexOf('>', openTagStart + 9)
    if (openTagEnd === -1) {
      return null
    }

    const closeTagStart = indexOfCI(sourceCode, '</template>', openTagEnd + 1)
    if (closeTagStart === -1) {
      return null
    }

    const contentStart = openTagEnd + 1
    const contentEnd = closeTagStart
    const content = sourceCode.slice(contentStart, contentEnd)

    return {
      content,
      start: contentStart,
      end: contentEnd
    }
  }

  return null
}

/**
 * @import { CoraliteDiagnostic } from '../types/index.js'
 */

/**
 * Extracts an inline template expression from a diagnostic message in linear O(n) time.
 * @param {string} [message] - Diagnostic message string
 * @returns {string|null} Extracted raw expression or null if not found
 */
function extractInlineExpression (message) {
  if (!message || typeof message !== 'string') {
    return null
  }

  const prefix = "Inline expression '{{"
  const start = message.indexOf(prefix)
  if (start === -1) {
    return null
  }

  const end = message.indexOf("}}'", start + prefix.length)
  if (end === -1) {
    return null
  }

  const expr = message.slice(start + prefix.length, end).trim()
  return expr || null
}

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

    const rawExpr = diag.fix?.expr || extractInlineExpression(diag.message)

    if (rawExpr) {
      const escapedExpr = rawExpr
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+')
      const mustacheRegex = new RegExp(`\\{\\{\\s*${escapedExpr}\\s*\\}\\}`, 'g')

      if (mustacheRegex.test(code)) {
        code = code.replace(mustacheRegex, diag.fix.replacement || `{{ ${getterInfo.name} }}`)
        if (!gettersToInject.some(g => g.name === getterInfo.name)) {
          gettersToInject.push(getterInfo)
        }

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
                hasRef: Boolean(attribs && Object.keys(attribs).some(a => a.toLowerCase() === 'ref')),
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
      const interactive = templateElements.filter(el => INTERACTIVE_TAGS.has(el.tagName))
      if (interactive.length > 0) {
        candidates = interactive
      } else {
        candidates = templateElements
      }
    }

    const eligibleCandidates = candidates.filter(el => !el.hasRef)

    if (eligibleCandidates.length === 1) {
      const candidateTag = eligibleCandidates[0].tagName
      const templateBlock = extractTemplateBlock(code)
      if (templateBlock) {
        const { content: templateContent, start: templateOffset } = templateBlock
        const tagRegex = new RegExp(`<(${candidateTag})([\\s>\\/])`, 'gi')
        let tagMatch
        while ((tagMatch = tagRegex.exec(templateContent)) !== null) {
          const endTagIndex = templateContent.indexOf('>', tagMatch.index)
          const fullTagStr = templateContent.slice(tagMatch.index, endTagIndex + 1)

          if (!/\bref\s*=/i.test(fullTagStr)) {
            const insertPos = templateOffset + tagMatch.index + 1 + candidateTag.length

            code = code.slice(0, insertPos) + ` ref="${strippedRef}"` + code.slice(insertPos)

            fixesApplied.push({
              code: 'CORALITE-E202',
              description: diag.fix.description || `Add ref="${strippedRef}" to matching <${candidateTag}> element`
            })

            break
          }
        }
      } else {
        const tagRegex = new RegExp(`<(${candidateTag})([\\s>\\/])`, 'gi')
        let tagMatch
        while ((tagMatch = tagRegex.exec(code)) !== null) {
          const endTagIndex = code.indexOf('>', tagMatch.index)
          const fullTagStr = code.slice(tagMatch.index, endTagIndex + 1)
          if (!/\bref\s*=/i.test(fullTagStr)) {
            const insertPos = tagMatch.index + 1 + candidateTag.length
            code = code.slice(0, insertPos) + ` ref="${strippedRef}"` + code.slice(insertPos)
            fixesApplied.push({
              code: 'CORALITE-E202',
              description: diag.fix.description || `Add ref="${strippedRef}" to matching <${candidateTag}> element`
            })
            break
          }
        }
      }
    }
  }

  // 1.3 CORALITE-E203 (Inline Event Listener Removal)
  const e203Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-E203' && d.fix?.action === 'remove_attribute')
  if (e203Diagnostics.length > 0) {
    const templateBlock = extractTemplateBlock(code)
    if (templateBlock) {
      let templateContent = templateBlock.content
      const templateStart = templateBlock.start
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
        code = code.slice(0, templateStart) + templateContent + code.slice(templateBlock.end)
      }
    } else if (indexOfCI(code, '<template') === -1) {
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

      // 2.0 CORALITE-E105 (Rewrite context.attributes to context.state)
      const e105Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-E105' && d.fix?.action === 'rewrite_context_attributes')
      if (e105Diagnostics.length > 0) {
        const e105Replacements = []

        walkAncestorJS(ast, {
          MemberExpression (memNode, ancestors) {
            if (
              memNode.object.type === 'Identifier' &&
              memNode.property.type === 'Identifier' &&
              memNode.property.name === 'attributes' &&
              !memNode.computed
            ) {
              const isInsideServerOrClient = ancestors.some(anc => {
                if (anc.type === 'Property' && anc.key && (anc.key.name === 'server' || anc.key.name === 'client')) {
                  return true
                }
                return false
              })

              if (isInsideServerOrClient) {
                const start = memNode.property.range[0]
                const end = memNode.property.range[1]
                e105Replacements.push({
                  start,
                  end,
                  replacement: 'state',
                  description: "Replace 'context.attributes' with 'context.state'"
                })
              }
            }
          },
          ObjectPattern (patNode, ancestors) {
            const isInsideServerOrClient = ancestors.some(anc => {
              if (anc.type === 'Property' && anc.key && (anc.key.name === 'server' || anc.key.name === 'client')) {
                return true
              }
              return false
            })

            if (isInsideServerOrClient) {
              for (const prop of patNode.properties || []) {
                if (
                  prop.type === 'Property' &&
                  prop.key.type === 'Identifier' &&
                  prop.key.name === 'attributes' &&
                  !prop.computed
                ) {
                  const start = prop.key.range[0]
                  const end = prop.key.range[1]
                  e105Replacements.push({
                    start,
                    end,
                    replacement: 'state',
                    description: "Replace '{ attributes }' with '{ state }'"
                  })
                }
              }
            }
          }
        })

        if (e105Replacements.length > 0) {
          e105Replacements.sort((a, b) => b.start - a.start)
          for (const rep of e105Replacements) {
            scriptContent = scriptContent.slice(0, rep.start) + rep.replacement + scriptContent.slice(rep.end)
            fixesApplied.push({
              code: 'CORALITE-E105',
              description: rep.description
            })
          }

          ast = parseJS(scriptContent, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true,
            ranges: true
          })
        }
      }

      // 2.0 CORALITE-W204 (Unwrap Redundant Ref Guards)
      const w204Diagnostics = diagnostics.filter(d => d.code === 'CORALITE-W204' && d.fix?.action === 'unwrap_ref_guard')
      if (w204Diagnostics.length > 0) {
        const scriptStartLine = isHtmlFile && scriptContent
          ? (code.slice(0, scriptStart).split('\n').length - 1)
          : 0
        const w204Lines = new Set(w204Diagnostics.map(d => d.line))
        const ifReplacements = []

        walkAncestorJS(ast, {
          IfStatement (ifNode) {
            if (ifNode.alternate) {
              return
            }
            if (w204Lines.has(ifNode.loc.start.line + scriptStartLine)) {
              let replacement = ''
              if (ifNode.consequent.type === 'BlockStatement') {
                const body = ifNode.consequent.body
                if (body.length > 0) {
                  replacement = scriptContent.slice(body[0].range[0], body[body.length - 1].range[1])
                } else {
                  replacement = ''
                }
              } else {
                replacement = scriptContent.slice(ifNode.consequent.range[0], ifNode.consequent.range[1])
              }

              const diag = w204Diagnostics.find(d => d.line === (ifNode.loc.start.line + scriptStartLine))
              ifReplacements.push({
                start: ifNode.range[0],
                end: ifNode.range[1],
                replacement,
                description: diag?.fix?.description || 'Unwrap redundant ref existence check'
              })
            }
          }
        })

        if (ifReplacements.length > 0) {
          ifReplacements.sort((a, b) => b.start - a.start)
          for (const rep of ifReplacements) {
            scriptContent = scriptContent.slice(0, rep.start) + rep.replacement + scriptContent.slice(rep.end)
            fixesApplied.push({
              code: 'CORALITE-W204',
              description: rep.description
            })
          }

          ast = parseJS(scriptContent, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true,
            ranges: true
          })
        }
      }

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
