import { Parser } from 'htmlparser2'
import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative, resolve } from 'node:path'
import { camelToKebab, kebabToCamel } from './utils/core.js'
import { buildCodeframe, formatValidationReport } from './utils/diagnostics.js'

/**
 * @import {
 *   CoraliteComponentValidationResult,
 *   CoraliteComponentDirectoryValidationReport,
 *   CoraliteDiagnostic
 * } from '../types/index.js'
 */

const RESERVED_CONTEXT_KEYS = new Set(['state', 'observe', 'signal', 'root', 'refs', 'instanceId', 'emit'])

const NUMBER_WORDS = {
  0: 'Zero',
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine'
}

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

function getPropKeyName (propNode) {
  if (!propNode) {
    return null
  }

  if (propNode.type === 'Property' || propNode.type === 'MethodDefinition') {
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
  }

  return null
}

function getNodePropName (propNode, isComputed = false) {
  if (!propNode) {
    return null
  }
  if (!isComputed) {
    if (propNode.type === 'Identifier') {
      return propNode.name
    }
    if (propNode.type === 'Literal') {
      return String(propNode.value)
    }
  } else if (propNode.type === 'Literal' && typeof propNode.value === 'string') {
    return propNode.value
  }
  return null
}

function extractDestructuredKeys (patternNode, targetSet, localBindingNames) {
  if (!patternNode || patternNode.type !== 'ObjectPattern') {
    return
  }

  for (const prop of patternNode.properties || []) {
    if (prop.type === 'Property') {
      const keyName = getPropKeyName(prop)
      if (keyName) {
        targetSet.add(keyName)
      }
      if (localBindingNames) {
        let valNode = prop.value
        if (valNode.type === 'AssignmentPattern') {
          valNode = valNode.left
        }
        if (valNode.type === 'Identifier') {
          localBindingNames.add(valNode.name)
        }
      }
    }
  }
}

function deriveGetterName (expr, existingKeys) {
  let processed = expr
    .replace(/!==|!=/g, ' NotEquals ')
    .replace(/===|==/g, ' Equals ')
    .replace(/>=/g, ' GreaterThanOrEqual ')
    .replace(/<=/g, ' LessThanOrEqual ')
    .replace(/>/g, ' GreaterThan ')
    .replace(/</g, ' LessThan ')
    .replace(/!/g, ' IsNot ')
    .replace(/\+/g, ' Plus ')
    .replace(/\-/g, ' Minus ')
    .replace(/\*/g, ' Times ')
    .replace(/\//g, ' Divide ')

  processed = processed.replace(/\b([0-9])\b/g, (m, d) => NUMBER_WORDS[d] || d)

  const tokens = processed.match(/[a-zA-Z0-9_]+/g) || []
  if (tokens.length === 0) {
    tokens.push('derived')
  }

  let name = ''
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (i === 0) {
      name += token.charAt(0).toLowerCase() + token.slice(1)
    } else {
      name += token.charAt(0).toUpperCase() + token.slice(1)
    }
  }

  if (!name || /^[0-9]/.test(name)) {
    name = 'derived' + (name ? name.charAt(0).toUpperCase() + name.slice(1) : '')
  }

  name = name.replace(/[^a-zA-Z0-9_$]/g, '')

  let candidate = name
  let suffix = 1
  while (existingKeys.has(candidate)) {
    candidate = `${name}${suffix}`
    suffix++
  }

  existingKeys.add(candidate)
  return candidate
}

function buildDefensiveExpr (node) {
  if (!node) {
    return "''"
  }

  switch (node.type) {
    case 'Identifier': {
      const name = node.name
      if (['undefined', 'null', 'true', 'false', 'NaN'].includes(name)) {
        return name
      }
      return `state.${name}`
    }
    case 'Literal': {
      return typeof node.value === 'string' ? `'${node.value}'` : JSON.stringify(node.value)
    }
    case 'MemberExpression': {
      const obj = buildDefensiveExpr(node.object)
      if (node.computed) {
        let prop = ''
        if (node.property.type === 'Literal') {
          prop = JSON.stringify(node.property.value)
        } else {
          prop = buildDefensiveExpr(node.property)
        }
        return `${obj}?.[${prop}]`
      } else {
        return `${obj}?.${node.property.name}`
      }
    }
    case 'BinaryExpression': {
      const left = buildDefensiveExpr(node.left)
      const right = buildDefensiveExpr(node.right)
      return `(${left} ${node.operator} ${right})`
    }
    case 'UnaryExpression': {
      const arg = buildDefensiveExpr(node.argument)
      return `${node.operator}${arg}`
    }
    case 'LogicalExpression': {
      const left = buildDefensiveExpr(node.left)
      const right = buildDefensiveExpr(node.right)
      return `(${left} ${node.operator} ${right})`
    }
    case 'ConditionalExpression': {
      const test = buildDefensiveExpr(node.test)
      const cons = buildDefensiveExpr(node.consequent)
      const alt = buildDefensiveExpr(node.alternate)
      return `${test} ? ${cons} : ${alt}`
    }
    case 'TemplateLiteral': {
      let res = '`'
      for (let i = 0; i < node.quasis.length; i++) {
        res += node.quasis[i].value.raw
        if (i < node.expressions.length) {
          const expDef = buildDefensiveExpr(node.expressions[i])
          res += `\${${expDef} ?? ''}`
        }
      }
      res += '`'
      return res
    }
    case 'CallExpression': {
      const callee = buildDefensiveExpr(node.callee)
      const args = node.arguments.map(a => buildDefensiveExpr(a)).join(', ')
      return `${callee}?.(${args})`
    }
    default: {
      return `state.${node.type}`
    }
  }
}

function generateGetterCode (getterName, expr) {
  let innerCode = ''
  let fallback = "''"

  try {
    const ast = parseJS(`(${expr})`, { ecmaVersion: 'latest' })
    const stmt = ast.body[0]

    if (stmt && stmt.type === 'ExpressionStatement') {
      const exprNode = stmt.expression
      innerCode = buildDefensiveExpr(exprNode)

      if (exprNode.type === 'BinaryExpression') {
        if (['+', '-', '*', '/', '%'].includes(exprNode.operator)) {
          fallback = '0'
        } else if (['>', '<', '>=', '<=', '==', '===', '!=', '!=='].includes(exprNode.operator)) {
          fallback = null
        }
      } else if (exprNode.type === 'UnaryExpression' && exprNode.operator === '!') {
        fallback = null
      } else if (exprNode.type === 'ConditionalExpression' || exprNode.type === 'TemplateLiteral') {
        fallback = null
      }
    } else {
      innerCode = `state.${expr.replace(/[^a-zA-Z0-9_.]/g, '')}`
    }
  } catch {
    const cleanExpr = expr.replace(/[^a-zA-Z0-9_.]/g, '')
    innerCode = `state.${cleanExpr}`
  }

  if (fallback !== null) {
    innerCode = `${innerCode} ?? ${fallback}`
  }

  return `${getterName}: (state) => ${innerCode}`
}

function extractIdentifiersFromExpr (expr, targetSet) {
  try {
    const ast = parseJS(`(${expr})`, { ecmaVersion: 'latest' })
    walkJS(ast, {
      Identifier (idNode) {
        if (!['undefined', 'null', 'true', 'false', 'NaN'].includes(idNode.name)) {
          targetSet.add(idNode.name)
        }
      }
    })
  } catch {
    const matches = expr.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || []
    for (const m of matches) {
      targetSet.add(m)
    }
  }
}

function createDiagnostic ({ code, severity, message, filePath, line, column, sourceCode, cause, fix }) {
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
 * Validates component source code for unused getters, server state, attributes, refs, top-level client imports,
 * template expressions, serialization boundaries, reactive loops, and attribute mutexes.
 *
 * @param {string} sourceCode - Raw component file content
 * @param {string} [filePath=''] - Path to component file for context
 * @returns {CoraliteComponentValidationResult} Validation result with diagnostics, defined, unused, and coverage metrics
 */
export function validateComponentSource (sourceCode, filePath = '') {
  let scriptContent = ''
  let styleContent = ''

  const templateTokens = new Set()
  // ref -> { line, column }
  const templateRefs = new Map()
  const diagnostics = []

  const definedAttributes = new Set()
  const definedServerProps = new Set()
  const definedGetters = new Set()
  // localName -> importSource
  const topLevelImports = new Map()
  // localName -> { line, column }
  const importLocations = new Map()
  // attr -> { line, column }
  const attributeLocations = new Map()
  const usedTopLevelImportsInClient = new Set()
  const usedTopLevelImportsOutsideClient = new Set()

  const stateReads = new Set()
  // ref -> { line, column }
  const refsCalls = new Map()
  const getterStateDependencies = new Set()

  // Pre-extract script section for initial symbol discovery
  if (sourceCode.includes('<script')) {
    const scriptMatch = sourceCode.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i)
    if (scriptMatch) {
      scriptContent = scriptMatch[1]
    }
  } else if (!sourceCode.includes('<template')) {
    scriptContent = sourceCode
  }

  // Parse Script AST first to populate definedAttributes, definedGetters, definedServerProps before template evaluation
  if (scriptContent) {
    try {
      const ast = parseJS(scriptContent, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      })

      const collectTopLevelImportsOutsideClient = (blockNode) => {
        if (!blockNode) {
          return
        }
        walkAncestorJS(blockNode, {
          Identifier (idNode, ancestors) {
            const idName = idNode.name
            if (topLevelImports.has(idName) && topLevelImports.get(idName) !== 'local') {
              const parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : null
              if (!parent) {
                return
              }
              if (parent.type === 'MemberExpression' && parent.property === idNode && !parent.computed) {
                return
              }
              if (parent.type === 'Property' && parent.key === idNode && !parent.computed && !parent.shorthand) {
                return
              }
              if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement' || parent.type === 'LabeledStatement') && parent.label === idNode) {
                return
              }
              if (parent.type === 'MetaProperty') {
                return
              }
              if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' || parent.type === 'ImportNamespaceSpecifier') {
                return
              }

              usedTopLevelImportsOutsideClient.add(idName)
            }
          }
        })
      }

      const extractPatternBindings = (patternNode, targetMap, isImport = false, importSource = '') => {
        if (!patternNode) {
          return
        }
        if (patternNode.type === 'Identifier') {
          targetMap.set(patternNode.name, isImport ? importSource : 'local')
          if (!importLocations.has(patternNode.name)) {
            importLocations.set(patternNode.name, {
              line: patternNode.loc.start.line,
              column: patternNode.loc.start.column + 1
            })
          }
        } else if (patternNode.type === 'ObjectPattern') {
          for (const prop of patternNode.properties || []) {
            if (prop.type === 'Property') {
              extractPatternBindings(prop.value, targetMap, isImport, importSource)
            } else if (prop.type === 'RestElement') {
              extractPatternBindings(prop.argument, targetMap, isImport, importSource)
            }
          }
        } else if (patternNode.type === 'ArrayPattern') {
          for (const el of patternNode.elements || []) {
            if (el) {
              extractPatternBindings(el, targetMap, isImport, importSource)
            }
          }
        } else if (patternNode.type === 'AssignmentPattern') {
          extractPatternBindings(patternNode.left, targetMap, isImport, importSource)
        } else if (patternNode.type === 'RestElement') {
          extractPatternBindings(patternNode.argument, targetMap, isImport, importSource)
        }
      }

      if (ast && ast.body) {
        for (const node of ast.body) {
          if (node.type === 'ImportDeclaration') {
            const source = node.source ? node.source.value : ''
            for (const spec of node.specifiers || []) {
              if (spec.local && spec.local.name) {
                topLevelImports.set(spec.local.name, source)
                importLocations.set(spec.local.name, {
                  line: spec.loc.start.line,
                  column: spec.loc.start.column + 1
                })
              }
            }
          } else if (node.type === 'VariableDeclaration') {
            for (const decl of node.declarations || []) {
              extractPatternBindings(decl.id, topLevelImports, false, 'local')
            }
          } else if (node.type === 'FunctionDeclaration') {
            if (node.id && node.id.type === 'Identifier') {
              extractPatternBindings(node.id, topLevelImports, false, 'local')
            }
          } else if (node.type === 'ClassDeclaration') {
            if (node.id && node.id.type === 'Identifier') {
              extractPatternBindings(node.id, topLevelImports, false, 'local')
            }
          }
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

            // Pre-pass: collect top-level imports used outside client() regardless of property order
            for (const prop of configObj.properties) {
              if (prop.type !== 'Property') {
                continue
              }
              const keyName = getPropKeyName(prop)
              if (keyName && ['server', 'getters', 'slots', 'style'].includes(keyName)) {
                collectTopLevelImportsOutsideClient(prop.value)
              }
            }

            for (const prop of configObj.properties) {
              if (prop.type !== 'Property') {
                continue
              }
              const keyName = getPropKeyName(prop)
              if (!keyName) {
                continue
              }

              if (keyName === 'attributes' && prop.value.type === 'ObjectExpression') {
                for (const attrProp of prop.value.properties) {
                  if (attrProp.type === 'Property') {
                    const attrName = getPropKeyName(attrProp)
                    if (attrName) {
                      definedAttributes.add(attrName)
                    }
                  }
                }
              }

              if (
                keyName === 'server' &&
                (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')
              ) {
                walkJS(prop.value.body, {
                  ReturnStatement (retNode) {
                    if (retNode.argument && retNode.argument.type === 'ObjectExpression') {
                      for (const retProp of retNode.argument.properties) {
                        if (retProp.type === 'Property') {
                          const propName = getPropKeyName(retProp)
                          if (propName) {
                            definedServerProps.add(propName)
                          }
                        }
                      }
                    }
                  }
                })
              }

              if (keyName === 'getters' && prop.value.type === 'ObjectExpression') {
                for (const getterProp of prop.value.properties) {
                  if (getterProp.type === 'Property') {
                    const gName = getPropKeyName(getterProp)
                    if (gName) {
                      definedGetters.add(gName)
                    }
                  }
                }
              }
            }
          }
        }
      })
    } catch {
      // Pre-pass fallback
    }
  }

  // 1. Template Parsing (htmlparser2)
  const templateElements = []
  if (sourceCode.includes('<template') || sourceCode.includes('<script') || sourceCode.includes('<style')) {
    let currentSection = null
    let templateDepth = 0
    let templateSearchOffset = 0
    const existingKeys = new Set([...definedGetters, ...definedAttributes, ...definedServerProps])

    const extractMustacheFromText = (text, searchFromIndex) => {
      const mustacheRegex = /\{\{\s*(.+?)\s*\}\}/g
      let match
      while ((match = mustacheRegex.exec(text)) !== null) {
        const fullMatch = match[0]
        const expr = match[1].trim()
        const loc = getLocForSubstring(sourceCode, fullMatch, searchFromIndex)

        if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(expr)) {
          templateTokens.add(expr)
        } else {
          // Non-pure identifier expression -> CORALITE-E201
          extractIdentifiersFromExpr(expr, templateTokens)

          const getterName = deriveGetterName(expr, existingKeys)
          const getterCode = generateGetterCode(getterName, expr)

          diagnostics.push(createDiagnostic({
            code: 'CORALITE-E201',
            severity: 'error',
            message: `Inline expression '{{ ${expr} }}' in template must be lifted to a derived getter.`,
            filePath,
            line: loc.line,
            column: loc.column,
            sourceCode,
            cause: 'Inline complex template expressions bypass static reactivity analysis. Lift expressions into derived getters.',
            fix: {
              action: 'lift_to_getter',
              description: `Lift expression to getter '${getterName}'`,
              replacement: `{{ ${getterName} }}`,
              getter: {
                name: getterName,
                code: getterCode
              }
            }
          }))
        }
      }
    }

    const checkAttribs = (attribs, tagSearchOffset) => {
      if (!attribs) {
        return
      }
      for (const [attrName, attrVal] of Object.entries(attribs)) {
        // CORALITE-E203: Inline event listener check
        if (/^on[a-z]+/i.test(attrName)) {
          const loc = getLocForSubstring(sourceCode, attrName, tagSearchOffset)
          diagnostics.push(createDiagnostic({
            code: 'CORALITE-E203',
            severity: 'error',
            message: `Inline event listener attribute '${attrName}' detected on element in <template>.`,
            filePath,
            line: loc.line,
            column: loc.column,
            sourceCode,
            cause: 'Inline event listeners violate Content Security Policy (CSP) and serialization boundaries.',
            fix: {
              action: 'remove_attribute',
              description: `Remove inline ${attrName} attribute and wire with refs() in client()`
            }
          }))
        }

        if (attrName.toLowerCase() === 'ref' && attrVal) {
          const loc = getLocForSubstring(sourceCode, attrVal, tagSearchOffset)
          templateRefs.set(attrVal, loc)
        }
        if (attrVal) {
          extractMustacheFromText(attrVal, tagSearchOffset)
        }
      }
    }

    scriptContent = ''
    styleContent = ''

    const parser = new Parser(
      {
        onopentag (name, attribs) {
          const lowerName = name.toLowerCase()
          if (currentSection === null) {
            if (lowerName === 'template') {
              currentSection = 'template'
              templateDepth = 1
              templateSearchOffset = sourceCode.indexOf('<template')
              checkAttribs(attribs, templateSearchOffset)
            } else if (lowerName === 'script') {
              currentSection = 'script'
            } else if (lowerName === 'style') {
              currentSection = 'style'
            }
          } else if (currentSection === 'template') {
            if (lowerName === 'template') {
              templateDepth++
            } else {
              templateElements.push({
                tagName: lowerName,
                id: attribs?.id ? String(attribs.id).trim() : null,
                className: attribs?.class ? String(attribs.class).trim() : null,
                hasRef: Boolean(attribs?.ref)
              })
            }
            checkAttribs(attribs, templateSearchOffset)
          }
        },
        ontext (text) {
          if (currentSection === 'template') {
            extractMustacheFromText(text, templateSearchOffset)
          } else if (currentSection === 'script') {
            scriptContent += text
          } else if (currentSection === 'style') {
            styleContent += text
          }
        },
        onclosetag (name) {
          const lowerName = name.toLowerCase()
          if (currentSection === 'template') {
            if (lowerName === 'template') {
              templateDepth--
              if (templateDepth === 0) {
                currentSection = null
              }
            }
          } else if (currentSection === 'script' && lowerName === 'script') {
            currentSection = null
          } else if (currentSection === 'style' && lowerName === 'style') {
            currentSection = null
          }
        }
      },
      {
        lowerCaseTags: true,
        lowerCaseAttributeNames: true
      }
    )

    parser.write(sourceCode)
    parser.end()
  } else {
    scriptContent = sourceCode
  }

  // Inline ignore directives: <!-- coralite-ignore symbol1 symbol2 --> or /* coralite-ignore symbol1 */
  const ignoredSymbols = new Set()
  let isEntireComponentIgnored = false

  if (sourceCode.includes('coralite-ignore') || sourceCode.includes('@coralite-ignore-unused')) {
    if (sourceCode.includes('coralite-ignore-unused') || sourceCode.includes('@coralite-ignore-unused')) {
      isEntireComponentIgnored = true
    }

    const ignoreCommentRegex = /(?:<!--|\/\*|\/\/)\s*coralite-ignore\s+([^\n]*?)(?:-->|\*\/|\n|$)/gi
    let iMatch
    while ((iMatch = ignoreCommentRegex.exec(sourceCode)) !== null) {
      const symbols = iMatch[1].split(/[\s,]+/).filter(Boolean)
      for (const sym of symbols) {
        ignoredSymbols.add(sym)
      }
    }
  }

  // 2. Full Script AST Analysis (acorn + acorn-walk)
  if (scriptContent) {
    try {
      const ast = parseJS(scriptContent, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      })

      if (ast && ast.body) {
        for (const node of ast.body) {
          if (node.type === 'ImportDeclaration') {
            const source = node.source ? node.source.value : ''
            for (const spec of node.specifiers || []) {
              if (spec.local && spec.local.name) {
                topLevelImports.set(spec.local.name, source)
                importLocations.set(spec.local.name, {
                  line: spec.loc.start.line,
                  column: spec.loc.start.column + 1
                })
              }
            }
          } else if (node.type === 'VariableDeclaration') {
            for (const decl of node.declarations || []) {
              if (decl.id && decl.id.type === 'Identifier') {
                topLevelImports.set(decl.id.name, 'local')
              }
            }
          } else if (node.type === 'FunctionDeclaration') {
            if (node.id && node.id.type === 'Identifier') {
              topLevelImports.set(node.id.name, 'local')
            }
          } else if (node.type === 'ClassDeclaration') {
            if (node.id && node.id.type === 'Identifier') {
              topLevelImports.set(node.id.name, 'local')
            }
          }
        }
      }


      const analyzeFunctionBlock = (fnNode, targetStateSet, targetRefsMap, isGetterFn = false, isClientFn = false, paramIdx = 0, isSlotFn = false) => {
        if (!fnNode || !fnNode.body) {
          return
        }

        const stateVars = new Set(['state'])
        const refsVars = new Set(['refs'])
        const contextVars = new Set(['context'])
        const errorsVars = new Set()

        const addErrorProp = (propName) => {
          if (propName && typeof propName === 'string') {
            targetStateSet.add(kebabToCamel(propName))
            targetStateSet.add(camelToKebab(propName))
          }
        }

        const extractErrorDestructuredKeys = (patternNode) => {
          if (!patternNode || patternNode.type !== 'ObjectPattern') {
            return
          }
          for (const prop of patternNode.properties || []) {
            if (prop.type === 'Property') {
              const keyName = getPropKeyName(prop)
              if (keyName) {
                addErrorProp(keyName)
              }
            }
          }
        }

        const processErrorsProperty = (propNode) => {
          let valNode = propNode.value
          if (valNode.type === 'AssignmentPattern') {
            valNode = valNode.left
          }
          if (valNode.type === 'Identifier') {
            errorsVars.add(valNode.name)
          } else if (valNode.type === 'ObjectPattern') {
            extractErrorDestructuredKeys(valNode)
          }
        }

        const processStateProperty = (propNode) => {
          let valNode = propNode.value
          if (valNode.type === 'AssignmentPattern') {
            valNode = valNode.left
          }
          if (valNode.type === 'Identifier') {
            stateVars.add(valNode.name)
          } else if (valNode.type === 'ObjectPattern') {
            extractDestructuredKeys(valNode, targetStateSet, stateVars)
            for (const p of valNode.properties || []) {
              if (p.type === 'Property' && getPropKeyName(p) === 'errors') {
                processErrorsProperty(p)
              }
            }
          }
        }

        if (fnNode.params && fnNode.params.length > paramIdx) {
          const targetParam = fnNode.params[paramIdx]
          if (targetParam.type === 'Identifier') {
            if (isGetterFn) {
              stateVars.add(targetParam.name)
            } else if (isSlotFn) {
              contextVars.add(targetParam.name)
              stateVars.add(targetParam.name)
            } else {
              contextVars.add(targetParam.name)
              if (targetParam.name === 'state') {
                stateVars.add('state')
              }
              if (targetParam.name === 'refs') {
                refsVars.add('refs')
              }
              if (targetParam.name === 'errors') {
                errorsVars.add('errors')
              }
            }
          } else if (targetParam.type === 'ObjectPattern') {
            if (isGetterFn) {
              extractDestructuredKeys(targetParam, targetStateSet)
            } else {
              for (const p of targetParam.properties || []) {
                if (p.type === 'Property') {
                  const keyName = getPropKeyName(p)
                  if (keyName === 'state') {
                    processStateProperty(p)
                  } else if (keyName === 'refs') {
                    if (p.value.type === 'Identifier') {
                      refsVars.add(p.value.name)
                    } else if (p.value.type === 'ObjectPattern') {
                      extractDestructuredKeys(p.value, null, refsVars)
                      for (const refProp of p.value.properties || []) {
                        const rName = getPropKeyName(refProp)
                        if (rName) {
                          targetRefsMap.set(rName, {
                            line: refProp.loc.start.line,
                            column: refProp.loc.start.column + 1
                          })
                        }
                      }
                    } else if (p.value.type === 'AssignmentPattern') {
                      if (p.value.left.type === 'Identifier') {
                        refsVars.add(p.value.left.name)
                      } else if (p.value.left.type === 'ObjectPattern') {
                        extractDestructuredKeys(p.value.left, null, refsVars)
                      }
                    }
                  } else if (keyName === 'errors') {
                    processErrorsProperty(p)
                  } else if (isSlotFn) {
                    if (!RESERVED_CONTEXT_KEYS.has(keyName)) {
                      targetStateSet.add(keyName)
                    }
                  }
                }
              }
            }
          }
        }

        walkJS(fnNode.body, {
          VariableDeclarator (dNode) {
            if (!dNode.init) {
              return
            }

            let initSource = null
            if (dNode.init.type === 'Identifier') {
              if (stateVars.has(dNode.init.name)) {
                initSource = 'state'
              } else if (refsVars.has(dNode.init.name)) {
                initSource = 'refs'
              } else if (contextVars.has(dNode.init.name)) {
                initSource = 'context'
              }
            } else if (dNode.init.type === 'MemberExpression') {
              if (dNode.init.object.type === 'Identifier' && contextVars.has(dNode.init.object.name)) {
                const propName = getNodePropName(dNode.init.property, dNode.init.computed)
                if (propName === 'state') {
                  initSource = 'state'
                } else if (propName === 'refs') {
                  initSource = 'refs'
                }
              }
            }

            if (dNode.init.type === 'Identifier') {
              if (stateVars.has(dNode.init.name)) {
                initSource = 'state'
              } else if (refsVars.has(dNode.init.name)) {
                initSource = 'refs'
              } else if (contextVars.has(dNode.init.name)) {
                initSource = 'context'
              } else if (errorsVars.has(dNode.init.name)) {
                initSource = 'errors'
              }
            } else if (dNode.init.type === 'MemberExpression') {
              let objName = null
              if (dNode.init.object.type === 'Identifier') {
                objName = dNode.init.object.name
              }
              const propName = getNodePropName(dNode.init.property, dNode.init.computed)

              if (objName && contextVars.has(objName)) {
                if (propName === 'state') {
                  initSource = 'state'
                } else if (propName === 'refs') {
                  initSource = 'refs'
                } else if (propName === 'errors') {
                  initSource = 'errors'
                }
              } else if (objName && stateVars.has(objName)) {
                if (propName === 'errors') {
                  initSource = 'errors'
                }
              } else if (
                dNode.init.object.type === 'MemberExpression' &&
                dNode.init.object.object.type === 'Identifier' &&
                contextVars.has(dNode.init.object.object.name)
              ) {
                const ctxProp = getNodePropName(dNode.init.object.property, dNode.init.object.computed)
                if (ctxProp === 'state' && propName === 'errors') {
                  initSource = 'errors'
                }
              }
            }

            if (initSource === 'state') {
              if (dNode.id.type === 'ObjectPattern') {
                extractDestructuredKeys(dNode.id, targetStateSet, stateVars)
                for (const p of dNode.id.properties || []) {
                  if (p.type === 'Property' && getPropKeyName(p) === 'errors') {
                    processErrorsProperty(p)
                  }
                }
              } else if (dNode.id.type === 'Identifier') {
                stateVars.add(dNode.id.name)
              }
            } else if (initSource === 'refs') {
              if (dNode.id.type === 'ObjectPattern') {
                for (const refProp of dNode.id.properties || []) {
                  const rName = getPropKeyName(refProp)
                  if (rName) {
                    targetRefsMap.set(rName, {
                      line: refProp.loc.start.line,
                      column: refProp.loc.start.column + 1
                    })
                  }
                }
              } else if (dNode.id.type === 'Identifier') {
                refsVars.add(dNode.id.name)
              }
            } else if (initSource === 'context') {
              if (dNode.id.type === 'ObjectPattern') {
                for (const p of dNode.id.properties || []) {
                  if (p.type === 'Property') {
                    const keyName = getPropKeyName(p)
                    if (keyName === 'state') {
                      processStateProperty(p)
                    } else if (keyName === 'refs') {
                      if (p.value.type === 'Identifier') {
                        refsVars.add(p.value.name)
                      } else if (p.value.type === 'ObjectPattern') {
                        for (const refProp of p.value.properties || []) {
                          const rName = getPropKeyName(refProp)
                          if (rName) {
                            targetRefsMap.set(rName, {
                              line: refProp.loc.start.line,
                              column: refProp.loc.start.column + 1
                            })
                          }
                        }
                      }
                    } else if (keyName === 'errors') {
                      processErrorsProperty(p)
                    }
                  }
                }
              }
            } else if (initSource === 'errors') {
              if (dNode.id.type === 'ObjectPattern') {
                extractErrorDestructuredKeys(dNode.id)
              } else if (dNode.id.type === 'Identifier') {
                errorsVars.add(dNode.id.name)
              }
            }
          },

          MemberExpression (memNode) {
            let matchedTarget = null
            let propNode = memNode.property

            if (memNode.object.type === 'Identifier') {
              if (errorsVars.has(memNode.object.name)) {
                matchedTarget = 'errors'
              } else if (stateVars.has(memNode.object.name)) {
                matchedTarget = 'state'
              } else if (refsVars.has(memNode.object.name)) {
                matchedTarget = 'refs'
              }
            } else if (memNode.object.type === 'MemberExpression') {
              const innerObj = memNode.object.object
              const innerProp = getNodePropName(memNode.object.property, memNode.object.computed)

              if (innerObj.type === 'Identifier' && stateVars.has(innerObj.name) && innerProp === 'errors') {
                matchedTarget = 'errors'
              } else if (innerObj.type === 'Identifier' && contextVars.has(innerObj.name)) {
                if (innerProp === 'state') {
                  matchedTarget = 'state'
                } else if (innerProp === 'refs') {
                  matchedTarget = 'refs'
                } else if (innerProp === 'errors') {
                  matchedTarget = 'errors'
                }
              } else if (
                innerObj.type === 'MemberExpression' &&
                innerObj.object.type === 'Identifier' &&
                contextVars.has(innerObj.object.name)
              ) {
                const ctxProp = getNodePropName(innerObj.property, innerObj.computed)
                if (ctxProp === 'state' && innerProp === 'errors') {
                  matchedTarget = 'errors'
                }
              }
            }

            if (matchedTarget === 'state') {
              const keyName = getNodePropName(propNode, memNode.computed)
              if (keyName) {
                targetStateSet.add(keyName)
              }
            } else if (matchedTarget === 'refs') {
              const keyName = getNodePropName(propNode, memNode.computed)
              if (keyName) {
                targetRefsMap.set(keyName, {
                  line: memNode.loc.start.line,
                  column: memNode.loc.start.column + 1
                })
              }
            } else if (matchedTarget === 'errors') {
              const keyName = getNodePropName(propNode, memNode.computed)
              if (keyName) {
                addErrorProp(keyName)
              }
            }
          },

          CallExpression (callNode) {
            let isRefCall = false
            if (callNode.callee.type === 'Identifier' && refsVars.has(callNode.callee.name)) {
              isRefCall = true
            } else if (callNode.callee.type === 'MemberExpression') {
              const calleeProp = getNodePropName(callNode.callee.property, callNode.callee.computed)
              if (calleeProp === 'refs') {
                isRefCall = true
              }
            }

            if (isRefCall && callNode.arguments.length > 0) {
              const arg0 = callNode.arguments[0]
              if (arg0.type === 'Literal' && typeof arg0.value === 'string') {
                targetRefsMap.set(arg0.value, {
                  line: callNode.loc.start.line,
                  column: callNode.loc.start.column + 1
                })
              }
            }

            // CORALITE-E302: Check for observe() state mutations
            const isObserveCall =
              (callNode.callee.type === 'Identifier' && callNode.callee.name === 'observe') ||
              (callNode.callee.type === 'MemberExpression' && getNodePropName(callNode.callee.property, callNode.callee.computed) === 'observe')

            if (isObserveCall && callNode.arguments.length > 0) {
              const callbackFn = callNode.arguments.length > 1 ? callNode.arguments[1] : callNode.arguments[0]
              if (callbackFn && (callbackFn.type === 'FunctionExpression' || callbackFn.type === 'ArrowFunctionExpression')) {
                const callbackStateVars = new Set(['state'])
                if (callbackFn.params && callbackFn.params.length > 0) {
                  const p0 = callbackFn.params[0]
                  if (p0.type === 'Identifier') {
                    callbackStateVars.add(p0.name)
                  }
                }

                const checkStateMutationTarget = (targetNode, locNode) => {
                  if (targetNode && targetNode.type === 'MemberExpression') {
                    let rootObj = targetNode.object
                    while (rootObj && rootObj.type === 'MemberExpression') {
                      rootObj = rootObj.object
                    }
                    if (rootObj && rootObj.type === 'Identifier' && callbackStateVars.has(rootObj.name)) {
                      diagnostics.push(createDiagnostic({
                        code: 'CORALITE-E302',
                        severity: 'warning',
                        message: 'State mutation detected inside observe() callback.',
                        filePath,
                        line: locNode.loc.start.line,
                        column: locNode.loc.start.column + 1,
                        sourceCode,
                        cause: 'Mutating state inside observe() callback creates reactive loops.',
                        fix: {
                          description: 'Move state mutation from observe() into a pure derived getter'
                        }
                      }))
                    }
                  }
                }

                walkJS(callbackFn.body, {
                  AssignmentExpression (assignNode) {
                    checkStateMutationTarget(assignNode.left, assignNode)
                  },
                  UpdateExpression (updateNode) {
                    checkStateMutationTarget(updateNode.argument, updateNode)
                  }
                })
              }
            }
          },

          Literal (litNode) {
            if (isClientFn && typeof litNode.value === 'string') {
              if (templateRefs.has(litNode.value)) {
                targetRefsMap.set(litNode.value, {
                  line: litNode.loc.start.line,
                  column: litNode.loc.start.column + 1
                })
              }
            }
          }
        })
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

            for (const prop of configObj.properties) {
              if (prop.type !== 'Property') {
                continue
              }
              const keyName = getPropKeyName(prop)
              if (!keyName) {
                continue
              }

              // Attributes schema validation
              if (keyName === 'attributes' && prop.value.type === 'ObjectExpression') {
                for (const attrProp of prop.value.properties) {
                  if (attrProp.type === 'Property') {
                    const attrName = getPropKeyName(attrProp)
                    if (attrName) {
                      attributeLocations.set(attrName, {
                        line: attrProp.loc.start.line,
                        column: attrProp.loc.start.column + 1
                      })

                      // CORALITE-E104: Reserved context key collision
                      if (RESERVED_CONTEXT_KEYS.has(attrName)) {
                        console.warn(`[Coralite Warning] Component attribute "${attrName}" in "${filePath || 'component'}" collides with a reserved context property (${attrName}).`)
                        diagnostics.push(createDiagnostic({
                          code: 'CORALITE-E104',
                          severity: 'error',
                          message: `Attribute '${attrName}' collides with reserved slot context key.`,
                          filePath,
                          line: attrProp.loc.start.line,
                          column: attrProp.loc.start.column + 1,
                          sourceCode,
                          cause: 'Property collides with reserved slot context keys.',
                          fix: {
                            description: 'Rename property to avoid collision with reserved slot context'
                          }
                        }))
                      }

                      if (attrProp.value.type === 'ObjectExpression') {
                        let hasRequiredTrue = false
                        let hasDefaultProp = false
                        let defaultPropNode = null

                        for (const cfgProp of attrProp.value.properties) {
                          if (cfgProp.type !== 'Property') {
                            continue
                          }
                          const cfgKey = getPropKeyName(cfgProp)

                          // CORALITE-E101: Blocked types (Array / Object)
                          if (cfgKey === 'type') {
                            let typeName = null
                            if (cfgProp.value.type === 'Identifier') {
                              typeName = cfgProp.value.name
                            } else if (cfgProp.value.type === 'Literal') {
                              typeName = String(cfgProp.value.value)
                            }
                            if (typeName === 'Array' || typeName === 'Object') {
                              diagnostics.push(createDiagnostic({
                                code: 'CORALITE-E101',
                                severity: 'error',
                                message: `Attribute '${attrName}' defines blocked type '${typeName}'.`,
                                filePath,
                                line: cfgProp.loc.start.line,
                                column: cfgProp.loc.start.column + 1,
                                sourceCode,
                                cause: 'Array and Object types in attributes cause state pollution and serialization boundary leaks.',
                                fix: {
                                  description: `Component attribute '${attrName}' cannot be Array or Object. Move initialization to async server() block.`
                                }
                              }))
                            }
                          }

                          // CORALITE-E102: Attribute Mutex (required: true & default)
                          if (cfgKey === 'required') {
                            if (
                              (cfgProp.value.type === 'Literal' && (cfgProp.value.value === true || cfgProp.value.value === 'true')) ||
                              (cfgProp.value.type === 'Identifier' && cfgProp.value.name === 'true')
                            ) {
                              hasRequiredTrue = true
                            }
                          }
                          if (cfgKey === 'default') {
                            hasDefaultProp = true
                            defaultPropNode = cfgProp
                          }

                          // CORALITE-E103: Async validate or transform
                          if (cfgKey === 'validate' || cfgKey === 'transform') {
                            const valNode = cfgProp.value
                            if (
                              valNode &&
                              (valNode.type === 'FunctionExpression' || valNode.type === 'ArrowFunctionExpression') &&
                              valNode.async
                            ) {
                              diagnostics.push(createDiagnostic({
                                code: 'CORALITE-E103',
                                severity: 'error',
                                message: `Attribute '${attrName}' specifies an async ${cfgKey} function.`,
                                filePath,
                                line: cfgProp.loc.start.line,
                                column: cfgProp.loc.start.column + 1,
                                sourceCode,
                                cause: 'Attribute transform and validate functions must be strictly synchronous.',
                                fix: {
                                  description: 'Make attribute validate/transform function synchronous'
                                }
                              }))
                            }
                          }
                        }

                        if (hasRequiredTrue && hasDefaultProp) {
                          const targetLoc = defaultPropNode ? defaultPropNode.loc : attrProp.loc
                          diagnostics.push(createDiagnostic({
                            code: 'CORALITE-E102',
                            severity: 'error',
                            message: `Attribute '${attrName}' specifies both required: true and a default value.`,
                            filePath,
                            line: targetLoc.start.line,
                            column: targetLoc.start.column + 1,
                            sourceCode,
                            cause: 'Attributes cannot specify both required: true and a default value.',
                            fix: {
                              action: 'strip_default',
                              description: `Remove default value from attribute '${attrName}' when required: true is set`
                            }
                          }))
                        }
                      }
                    }
                  }
                }
              }

              // Server block return values & body state/refs accesses
              if (
                keyName === 'server' &&
                (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')
              ) {
                analyzeFunctionBlock(prop.value, stateReads, refsCalls, false, false, 0)

                walkJS(prop.value.body, {
                  ReturnStatement (retNode) {
                    if (retNode.argument && retNode.argument.type === 'ObjectExpression') {
                      for (const retProp of retNode.argument.properties) {
                        if (retProp.type === 'Property') {
                          const propName = getPropKeyName(retProp)
                          if (propName) {
                            // CORALITE-E104: Reserved context collision
                            if (RESERVED_CONTEXT_KEYS.has(propName)) {
                              console.warn(`[Coralite Warning] Component server property "${propName}" in "${filePath || 'component'}" collides with a reserved context property (${propName}).`)
                              diagnostics.push(createDiagnostic({
                                code: 'CORALITE-E104',
                                severity: 'error',
                                message: `Server property '${propName}' collides with reserved slot context key.`,
                                filePath,
                                line: retProp.loc.start.line,
                                column: retProp.loc.start.column + 1,
                                sourceCode,
                                cause: 'Property collides with reserved slot context keys.',
                                fix: {
                                  description: 'Rename property to avoid collision with reserved slot context'
                                }
                              }))
                            }
                          }
                        }
                      }
                    }
                  }
                })
              }

              // Getters block
              if (keyName === 'getters' && prop.value.type === 'ObjectExpression') {
                for (const getterProp of prop.value.properties) {
                  if (getterProp.type === 'Property') {
                    const gName = getPropKeyName(getterProp)
                    if (gName) {
                      if (
                        getterProp.value.type === 'ArrowFunctionExpression' ||
                        getterProp.value.type === 'FunctionExpression'
                      ) {
                        analyzeFunctionBlock(getterProp.value, getterStateDependencies, refsCalls, true, false, 0)
                      }
                    }
                  }
                }
              }

              // Slots block
              if (keyName === 'slots' && prop.value.type === 'ObjectExpression') {
                for (const slotProp of prop.value.properties) {
                  if (
                    slotProp.type === 'Property' &&
                    (slotProp.value.type === 'FunctionExpression' || slotProp.value.type === 'ArrowFunctionExpression')
                  ) {
                    analyzeFunctionBlock(slotProp.value, stateReads, refsCalls, false, false, 1, true)
                  }
                }
              }

              // Style block
              if (keyName === 'style' && prop.value.type === 'ObjectExpression') {
                for (const styleProp of prop.value.properties) {
                  if (styleProp.type === 'Property') {
                    const sName = getPropKeyName(styleProp)
                    const fnVal = styleProp.value

                    // CORALITE-E303: Async style getter
                    if (
                      fnVal &&
                      (fnVal.type === 'FunctionExpression' || fnVal.type === 'ArrowFunctionExpression') &&
                      fnVal.async
                    ) {
                      diagnostics.push(createDiagnostic({
                        code: 'CORALITE-E303',
                        severity: 'error',
                        message: `Style getter function '${sName}' is async or returns a Promise.`,
                        filePath,
                        line: styleProp.loc.start.line,
                        column: styleProp.loc.start.column + 1,
                        sourceCode,
                        cause: 'Style getter functions must be strictly synchronous.',
                        fix: {
                          description: 'Make style property function synchronous'
                        }
                      }))
                    }

                    if (
                      fnVal &&
                      (fnVal.type === 'FunctionExpression' || fnVal.type === 'ArrowFunctionExpression')
                    ) {
                      analyzeFunctionBlock(fnVal, stateReads, refsCalls, true, false, 0)
                    }
                  }
                }
              }

              // Client block AST
              if (
                keyName === 'client' &&
                (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')
              ) {
                if (topLevelImports.size > 0 && prop.value) {
                  const clientLocalVars = new Set()

                  const extractPatternNames = (pattern) => {
                    if (!pattern) {
                      return
                    }
                    if (pattern.type === 'Identifier') {
                      clientLocalVars.add(pattern.name)
                    } else if (pattern.type === 'ObjectPattern') {
                      for (const p of pattern.properties || []) {
                        if (p.type === 'Property') {
                          extractPatternNames(p.value)
                        } else if (p.type === 'RestElement') {
                          extractPatternNames(p.argument)
                        }
                      }
                    } else if (pattern.type === 'ArrayPattern') {
                      for (const el of pattern.elements || []) {
                        if (el) {
                          extractPatternNames(el)
                        }
                      }
                    } else if (pattern.type === 'AssignmentPattern') {
                      extractPatternNames(pattern.left)
                    } else if (pattern.type === 'RestElement') {
                      extractPatternNames(pattern.argument)
                    }
                  }

                  if (prop.value.params) {
                    for (const param of prop.value.params) {
                      extractPatternNames(param)
                    }
                  }

                  if (prop.value.body) {
                    walkJS(prop.value.body, {
                      VariableDeclarator (dNode) {
                        extractPatternNames(dNode.id)
                      },
                      FunctionDeclaration (fNode) {
                        if (fNode.id && fNode.id.type === 'Identifier') {
                          clientLocalVars.add(fNode.id.name)
                        }
                      },
                      ClassDeclaration (cNode) {
                        if (cNode.id && cNode.id.type === 'Identifier') {
                          clientLocalVars.add(cNode.id.name)
                        }
                      },
                      CatchClause (cClause) {
                        if (cClause.param) {
                          extractPatternNames(cClause.param)
                        }
                      }
                    })

                    walkAncestorJS(prop.value.body, {
                      Identifier (idNode, ancestors) {
                        const idName = idNode.name
                        if (topLevelImports.has(idName) && !clientLocalVars.has(idName)) {
                          const parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : null
                          if (!parent) {
                            return
                          }

                          if (parent.type === 'MemberExpression' && parent.property === idNode && !parent.computed) {
                            return
                          }

                          if (parent.type === 'Property' && parent.key === idNode && !parent.computed && !parent.shorthand) {
                            return
                          }

                          if (
                            (parent.type === 'BreakStatement' || parent.type === 'ContinueStatement' || parent.type === 'LabeledStatement') &&
                            parent.label === idNode
                          ) {
                            return
                          }

                          if (parent.type === 'MetaProperty') {
                            return
                          }

                          if (!usedTopLevelImportsInClient.has(idName)) {
                            usedTopLevelImportsInClient.add(idName)

                            // CORALITE-E301: Serialization boundary leak
                            const importSource = topLevelImports.get(idName) || 'module'
                            const isLocalDecl = importSource === 'local'

                            const fixPayload = isLocalDecl
                              ? {
                                description: `Variable '${idName}' declared in top-level script scope cannot be serialized to client(). Move inside client() or initialize via server().`
                              }
                              : {
                                action: 'dynamic_import',
                                description: `Convert top-level import '${idName}' to dynamic import inside client()`,
                                replacement: `const { ${idName} } = await import('${importSource}')`,
                                isSharedWithOtherBlocks: usedTopLevelImportsOutsideClient.has(idName)
                              }

                            diagnostics.push(createDiagnostic({
                              code: 'CORALITE-E301',
                              severity: 'error',
                              message: isLocalDecl
                                ? `Top-level variable '${idName}' referenced inside client() block.`
                                : `Top-level import '${idName}' referenced inside client() block.`,
                              filePath,
                              line: idNode.loc.start.line,
                              column: idNode.loc.start.column + 1,
                              sourceCode,
                              cause: isLocalDecl
                                ? 'Variables declared in the top-level script scope cannot be serialized to the browser client() block.'
                                : 'Top-level imports cannot be referenced inside client() block as client code is executed in browser context.',
                              fix: fixPayload
                            }))
                          }
                        }
                      }
                    })
                  }
                }

                const refVarToRefName = new Map()

                const clientFnBody = 'body' in prop.value ? prop.value.body : null
                if (clientFnBody) {
                  walkJS(clientFnBody, {
                    VariableDeclarator (dNode) {
                      if (!dNode.init) {
                        return
                      }
                      let refName = null
                      if (dNode.init.type === 'CallExpression') {
                        const callee = dNode.init.callee
                        let isRefsCall = false
                        if (callee.type === 'Identifier' && callee.name === 'refs') {
                          isRefsCall = true
                        } else if (callee.type === 'MemberExpression') {
                          const pName = getNodePropName(callee.property, callee.computed)
                          if (pName === 'refs') {
                            isRefsCall = true
                          }
                        }
                        if (isRefsCall && dNode.init.arguments.length > 0) {
                          const arg0 = dNode.init.arguments[0]
                          if (arg0.type === 'Literal' && typeof arg0.value === 'string') {
                            refName = arg0.value
                          }
                        }
                      } else if (dNode.init.type === 'MemberExpression') {
                        if (dNode.init.object.type === 'Identifier' && dNode.init.object.name === 'refs') {
                          refName = getNodePropName(dNode.init.property, dNode.init.computed)
                        }
                      } else if (dNode.init.type === 'Identifier' && dNode.init.name === 'refs') {
                        if (dNode.id.type === 'ObjectPattern') {
                          for (const p of dNode.id.properties || []) {
                            if (p.type === 'Property' && p.value.type === 'Identifier') {
                              const keyName = getPropKeyName(p)
                              if (keyName) {
                                refVarToRefName.set(p.value.name, keyName)
                              }
                            }
                          }
                        }
                      }

                      if (refName) {
                        if (dNode.id.type === 'Identifier') {
                          refVarToRefName.set(dNode.id.name, refName)
                        } else if (dNode.id.type === 'ObjectPattern') {
                          for (const p of dNode.id.properties || []) {
                            if (p.type === 'Property' && p.value.type === 'Identifier') {
                              const keyName = getPropKeyName(p)
                              refVarToRefName.set(p.value.name, keyName || refName)
                            }
                          }
                        }
                      }
                    }
                  })

                  const getRefNameFromTest = (testNode) => {
                    if (!testNode) {
                      return null
                    }
                    if (testNode.type === 'Identifier') {
                      if (refVarToRefName.has(testNode.name)) {
                        return refVarToRefName.get(testNode.name)
                      }
                    } else if (testNode.type === 'CallExpression') {
                      const callee = testNode.callee
                      let isRefsCall = false
                      if (callee.type === 'Identifier' && callee.name === 'refs') {
                        isRefsCall = true
                      } else if (callee.type === 'MemberExpression') {
                        const pName = getNodePropName(callee.property, callee.computed)
                        if (pName === 'refs') {
                          isRefsCall = true
                        }
                      }
                      if (isRefsCall && testNode.arguments.length > 0) {
                        const arg0 = testNode.arguments[0]
                        if (arg0.type === 'Literal' && typeof arg0.value === 'string') {
                          return arg0.value
                        }
                      }
                    } else if (testNode.type === 'MemberExpression') {
                      if (testNode.object.type === 'Identifier' && testNode.object.name === 'refs') {
                        return getNodePropName(testNode.property, testNode.computed)
                      }
                    }
                    return null
                  }

                  walkAncestorJS(clientFnBody, {
                    IfStatement (ifNode, ancestors) {
                      /** @type {any} */
                      const clientBodyNode = clientFnBody
                      const bodyIdx = ancestors.indexOf(clientBodyNode)
                      if (bodyIdx === -1) {
                        return
                      }
                      let isTopLevel = true
                      for (let i = bodyIdx + 1; i < ancestors.length - 1; i++) {
                        const nodeType = ancestors[i].type
                        if (
                          nodeType === 'FunctionDeclaration' ||
                          nodeType === 'FunctionExpression' ||
                          nodeType === 'ArrowFunctionExpression' ||
                          nodeType === 'MethodDefinition'
                        ) {
                          isTopLevel = false
                          break
                        }
                      }
                      if (!isTopLevel) {
                        return
                      }

                      const refName = getRefNameFromTest(ifNode.test)
                      if (refName) {
                        diagnostics.push(createDiagnostic({
                          code: 'CORALITE-W204',
                          severity: 'warning',
                          message: `Redundant existence check on ref "${refName}". Template refs are guaranteed to exist at component mount time. Use direct access 'refs("${refName}").method()' and pass '{ signal }' for lifecycle management.`,
                          filePath,
                          line: ifNode.loc.start.line,
                          column: ifNode.loc.start.column + 1,
                          sourceCode,
                          cause: `Top-level ref existence check on "${refName}" is redundant because Coralite guarantees refs exist at mount time.`,
                          fix: !ifNode.alternate ? {
                            action: 'unwrap_ref_guard',
                            description: `Unwrap redundant existence check for ref '${refName}'`
                          } : null
                        }))
                      }
                    }
                  })
                }

                analyzeFunctionBlock(prop.value, stateReads, refsCalls, false, true, 0)
              }
            }
          }
        }
      })
    } catch {
      // AST parse error fallback
    }
  }

  // 3. CSS Attribute & DOM Host Selector Check
  const combinedCssAndSource = (styleContent + '\n' + sourceCode).toLowerCase()
  for (const attr of definedAttributes) {
    const kebabAttr = camelToKebab(attr)
    if (
      combinedCssAndSource.includes(`[${kebabAttr}`) ||
      combinedCssAndSource.includes(`[${attr.toLowerCase()}`) ||
      combinedCssAndSource.includes(`getattribute('${kebabAttr}')`) ||
      combinedCssAndSource.includes(`getattribute("${kebabAttr}")`) ||
      combinedCssAndSource.includes(`getattribute('${attr}')`) ||
      combinedCssAndSource.includes(`getattribute("${attr}")`)
    ) {
      stateReads.add(attr)
    }
  }

  // Cross-reference unused items & emit CORALITE-W401
  const unusedGetters = []
  for (const getter of definedGetters) {
    if (!isEntireComponentIgnored && !ignoredSymbols.has(getter) && !templateTokens.has(getter) && !stateReads.has(getter)) {
      unusedGetters.push(getter)
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W401',
        severity: 'warning',
        message: `Unused getter '${getter}'.`,
        filePath,
        line: 1,
        column: 1,
        sourceCode,
        cause: `Unreferenced getter '${getter}'.`,
        fix: {
          description: 'Remove unused getter/serverProp/attribute'
        }
      }))
    }
  }

  const unusedServerProps = []
  for (const prop of definedServerProps) {
    if (
      !isEntireComponentIgnored &&
      !ignoredSymbols.has(prop) &&
      !templateTokens.has(prop) &&
      !stateReads.has(prop) &&
      !getterStateDependencies.has(prop)
    ) {
      unusedServerProps.push(prop)
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W401',
        severity: 'warning',
        message: `Unused server property '${prop}'.`,
        filePath,
        line: 1,
        column: 1,
        sourceCode,
        cause: `Unreferenced server property '${prop}'.`,
        fix: {
          description: 'Remove unused getter/serverProp/attribute'
        }
      }))
    }
  }

  const unusedAttributes = []
  for (const attr of definedAttributes) {
    const errorCamelToken = 'error_' + kebabToCamel(attr)
    const errorKebabToken = 'error_' + camelToKebab(attr)
    const isErrorTokenUsed = templateTokens.has(errorCamelToken) || templateTokens.has(errorKebabToken) || stateReads.has(errorCamelToken) || stateReads.has(errorKebabToken)

    if (
      !isEntireComponentIgnored &&
      !ignoredSymbols.has(attr) &&
      !templateTokens.has(attr) &&
      !stateReads.has(attr) &&
      !getterStateDependencies.has(attr) &&
      !definedServerProps.has(attr) &&
      !isErrorTokenUsed
    ) {
      unusedAttributes.push(attr)
      const loc = attributeLocations.get(attr) || {
        line: 1,
        column: 1
      }
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W401',
        severity: 'warning',
        message: `Unused attribute '${attr}'.`,
        filePath,
        line: loc.line,
        column: loc.column,
        sourceCode,
        cause: `Unreferenced attribute '${attr}'.`,
        fix: {
          description: 'Remove unused getter/serverProp/attribute'
        }
      }))
    }
  }

  // Element refs cross-referencing (CORALITE-W402 & CORALITE-E202)
  const unusedRefs = []
  for (const [ref, loc] of templateRefs.entries()) {
    const refToken = 'ref_' + ref
    const refCamelToken = 'ref_' + kebabToCamel(ref)
    const refKebabToken = 'ref_' + camelToKebab(ref)

    const isUsed =
      refsCalls.has(ref) ||
      refsCalls.has(refToken) ||
      refsCalls.has(refCamelToken) ||
      refsCalls.has(refKebabToken) ||
      templateTokens.has(refToken) ||
      templateTokens.has(refCamelToken) ||
      templateTokens.has(refKebabToken) ||
      stateReads.has(refToken) ||
      stateReads.has(refCamelToken) ||
      stateReads.has(refKebabToken) ||
      getterStateDependencies.has(refToken) ||
      getterStateDependencies.has(refCamelToken) ||
      getterStateDependencies.has(refKebabToken)

    const isIgnored =
      isEntireComponentIgnored ||
      ignoredSymbols.has(ref) ||
      ignoredSymbols.has(refToken) ||
      ignoredSymbols.has(refCamelToken) ||
      ignoredSymbols.has(refKebabToken)

    if (!isUsed && !isIgnored) {
      unusedRefs.push(ref)
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-W402',
        severity: 'warning',
        message: `Element ref '${ref}' defined in template but never accessed.`,
        filePath,
        line: loc.line,
        column: loc.column,
        sourceCode,
        cause: `Unused ref="${ref}" attribute in template.`,
        fix: {
          description: 'Remove unused ref attribute'
        }
      }))
    }
  }

  // Collect candidate ref references from refsCalls, templateTokens, stateReads, getterStateDependencies
  const candidateRefRefs = new Map()

  const addCandidateRef = (rawName, sourceToken) => {
    let stripped = rawName
    if (stripped.startsWith('ref_')) {
      stripped = stripped.slice(4)
    }
    if (!candidateRefRefs.has(stripped)) {
      candidateRefRefs.set(stripped, new Set())
    }
    candidateRefRefs.get(stripped).add(sourceToken || rawName)
  }

  for (const call of refsCalls.keys()) {
    addCandidateRef(call, call)
  }
  for (const token of templateTokens) {
    if (token.startsWith('ref_')) {
      addCandidateRef(token, token)
    }
  }
  for (const read of stateReads) {
    if (read.startsWith('ref_')) {
      addCandidateRef(read, read)
    }
  }
  for (const dep of getterStateDependencies) {
    if (dep.startsWith('ref_')) {
      addCandidateRef(dep, dep)
    }
  }

  const missingRefs = []
  for (const [strippedRef, sourceTokens] of candidateRefRefs.entries()) {
    const refToken = 'ref_' + strippedRef
    const refCamel = kebabToCamel(strippedRef)
    const refKebab = camelToKebab(strippedRef)

    let existsInTemplate = templateRefs.has(strippedRef) || templateRefs.has(refKebab) || templateRefs.has(refCamel)
    if (!existsInTemplate) {
      for (const tRef of templateRefs.keys()) {
        if (kebabToCamel(tRef) === refCamel || camelToKebab(tRef) === refKebab) {
          existsInTemplate = true
          break
        }
      }
    }

    if (existsInTemplate) {
      continue
    }

    const isDefinedElsewhere =
      definedAttributes.has(strippedRef) ||
      definedAttributes.has(refToken) ||
      definedAttributes.has(refCamel) ||
      definedServerProps.has(strippedRef) ||
      definedServerProps.has(refToken) ||
      definedServerProps.has(refCamel) ||
      definedGetters.has(strippedRef) ||
      definedGetters.has(refToken) ||
      definedGetters.has(refCamel)

    if (isDefinedElsewhere) {
      continue
    }

    let isIgnored = isEntireComponentIgnored || ignoredSymbols.has(strippedRef) || ignoredSymbols.has(refToken) || ignoredSymbols.has(refCamel)
    if (!isIgnored) {
      for (const token of sourceTokens) {
        if (ignoredSymbols.has(token)) {
          isIgnored = true
          break
        }
      }
    }

    if (!isIgnored) {
      missingRefs.push(strippedRef)
      const callLoc = refsCalls.get(strippedRef) || refsCalls.get('ref_' + strippedRef) || {
        line: 1,
        column: 1
      }

      // Candidate matching logic
      const isSemanticMatch = (el) => {
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

      let candidates = templateElements.filter(isSemanticMatch)
      if (candidates.length === 0) {
        const interactiveCandidates = templateElements.filter(el => ['button', 'input', 'form', 'a', 'select', 'textarea'].includes(el.tagName))
        if (interactiveCandidates.length > 0) {
          candidates = interactiveCandidates
        } else {
          candidates = templateElements
        }
      }

      const candidateCount = candidates.length
      const candidateTag = candidateCount === 1 ? candidates[0].tagName : null

      const causeMessage = candidateCount === 1
        ? `Found 1 matching candidate element (<${candidateTag}>) in template for ref "${strippedRef}".`
        : `Found ${candidateCount} candidate elements in template for ref "${strippedRef}". Auto-injection skipped due to ambiguity.`

      const fixPayload = candidateCount === 1
        ? {
          action: 'inject_ref',
          description: `Add ref="${strippedRef}" to matching <${candidateTag}> element`,
          replacement: `ref="${strippedRef}"`
        }
        : {
          description: `Manually add ref="${strippedRef}" to target element in template`
        }

      diagnostics.push(createDiagnostic({
        code: 'CORALITE-E202',
        severity: 'error',
        message: `Missing ref "${strippedRef}" in template`,
        filePath,
        line: callLoc.line,
        column: callLoc.column,
        sourceCode,
        cause: causeMessage,
        fix: fixPayload
      }))
    }
  }

  const invalidClientImports = Array.from(usedTopLevelImportsInClient)

  const totalDefined = definedGetters.size + definedServerProps.size + definedAttributes.size + templateRefs.size
  const totalUnused = unusedGetters.length + unusedServerProps.length + unusedAttributes.length + unusedRefs.length + invalidClientImports.length
  const totalErrors = diagnostics.filter(d => d.severity === 'error').length
  const valid = totalErrors === 0 && totalUnused === 0
  const usageCoveragePercentage = totalDefined > 0
    ? Math.round(((totalDefined - totalUnused) / totalDefined) * 100)
    : 100

  return {
    filePath,
    valid,
    diagnostics,
    defined: {
      getters: Array.from(definedGetters),
      serverProps: Array.from(definedServerProps),
      attributes: Array.from(definedAttributes),
      refs: Array.from(templateRefs.keys()),
      imports: Array.from(topLevelImports.keys())
    },
    unused: {
      getters: unusedGetters,
      serverProps: unusedServerProps,
      attributes: unusedAttributes,
      refs: unusedRefs,
      missingRefs,
      invalidClientImports,
      invalidImports: invalidClientImports
    },
    metrics: {
      totalDefined,
      totalUnused,
      totalErrors,
      usageCoveragePercentage
    }
  }
}

/**
 * Scans a directory recursively for component files (.html / .js) and validates usage.
 *
 * @param {string} componentsDir - Path to components directory
 * @param {Object} [options={}] - Options like coverage flag
 * @returns {CoraliteComponentDirectoryValidationReport} Aggregated directory validation report
 */
export function validateComponentsDir (componentsDir, options = {}) {
  const absoluteDir = resolve(componentsDir)
  const results = []

  if (!existsSync(absoluteDir)) {
    throw new Error(`Components directory not found: ${absoluteDir}`)
  }

  function scanDir (dir) {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        scanDir(fullPath)
      } else if (stat.isFile() && (extname(entry) === '.html' || extname(entry) === '.js')) {
        const content = readFileSync(fullPath, 'utf8')
        if (content.includes('defineComponent') || content.includes('<template')) {
          const relPath = relative(process.cwd(), fullPath)
          const result = validateComponentSource(content, relPath)
          results.push(result)
        }
      }
    }
  }

  scanDir(absoluteDir)

  let totalDefined = 0
  let totalUnused = 0
  let errorCount = 0
  let warningCount = 0
  let fixableCount = 0
  let validComponents = 0

  for (const res of results) {
    totalDefined += res.metrics?.totalDefined || 0
    totalUnused += res.metrics?.totalUnused || 0
    const errs = (res.diagnostics || []).filter(d => d.severity === 'error').length
    const warns = (res.diagnostics || []).filter(d => d.severity === 'warning').length
    const fixables = (res.diagnostics || []).filter(d => Boolean(d.fix)).length

    errorCount += errs
    warningCount += warns
    fixableCount += fixables

    if (res.valid) {
      validComponents++
    }
  }

  const overallCoveragePercentage = totalDefined > 0
    ? Math.round(((totalDefined - totalUnused) / totalDefined) * 100)
    : 100

  return {
    components: results,
    summary: {
      totalComponents: results.length,
      validComponents,
      errorCount,
      warningCount,
      fixableCount,
      usageCoveragePercentage: overallCoveragePercentage
    },
    metrics: {
      totalComponents: results.length,
      validComponents,
      totalDefined,
      totalUnused,
      totalErrors: errorCount,
      overallCoveragePercentage,
      coverageReportEnabled: !!options.coverage
    }
  }
}

/**
 * Formats component validation results into human-readable terminal output or JSON string.
 *
 * @param {Object} report - Validation report from validateComponentsDir
 * @param {Object} [options={}] - Formatting options (format: 'console'|'json')
 * @returns {string} Formatted output string
 */
export function formatComponentValidationReport (report, options = {}) {
  return formatValidationReport(report, options)
}

// Backwards compatibility aliases
export const analyseComponentSource = validateComponentSource
export const analyseComponentsDir = validateComponentsDir
export const formatComponentAnalysis = formatComponentValidationReport
export const analyzeComponentSource = validateComponentSource
export const analyzeComponentsDir = validateComponentsDir
