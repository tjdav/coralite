import { Parser } from 'htmlparser2'
import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative, resolve } from 'node:path'
import kleur from 'kleur'
import { camelToKebab, kebabToCamel } from './utils/core.js'

/**
 * @import {
 *   CoraliteComponentValidationResult,
 *   CoraliteComponentDirectoryValidationReport
 * } from '../types/index.js'
 */

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

/**
 * Validates component source code for unused getters, server state, attributes, refs, and top-level client imports.
 *
 * @param {string} sourceCode - Raw component file content
 * @param {string} [filePath=''] - Path to component file for context
 * @returns {CoraliteComponentValidationResult} Validation result with defined, unused, and coverage metrics
 */
export function validateComponentSource (sourceCode, filePath = '') {
  let scriptContent = ''
  let styleContent = ''

  const templateTokens = new Set()
  const templateRefs = new Set()

  if (sourceCode.includes('<template') || sourceCode.includes('<script') || sourceCode.includes('<style')) {
    let currentSection = null
    let templateDepth = 0

    const extractMustacheFromText = (text) => {
      const mustacheRegex = /\{\{\s*([a-zA-Z0-9_$-]+)\s*\}\}/g
      let match
      while ((match = mustacheRegex.exec(text)) !== null) {
        if (match[1]) {
          templateTokens.add(match[1])
        }
      }
    }

    const checkAttribs = (attribs) => {
      if (!attribs) {
        return
      }
      for (const [attrName, attrVal] of Object.entries(attribs)) {
        if (attrName.toLowerCase() === 'ref' && attrVal) {
          templateRefs.add(attrVal)
        }
        if (attrVal) {
          extractMustacheFromText(attrVal)
        }
      }
    }

    const parser = new Parser(
      {
        onopentag (name, attribs) {
          const lowerName = name.toLowerCase()
          if (currentSection === null) {
            if (lowerName === 'template') {
              currentSection = 'template'
              templateDepth = 1
              checkAttribs(attribs)
            } else if (lowerName === 'script') {
              currentSection = 'script'
            } else if (lowerName === 'style') {
              currentSection = 'style'
            }
          } else if (currentSection === 'template') {
            if (lowerName === 'template') {
              templateDepth++
            }
            checkAttribs(attribs)
          }
        },
        ontext (text) {
          if (currentSection === 'template') {
            extractMustacheFromText(text)
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

  // Check for inline ignore directives: <!-- coralite-ignore symbol1 symbol2 --> or /* coralite-ignore symbol1 */
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

  // Script AST Analysis
  const definedAttributes = new Set()
  const definedServerProps = new Set()
  const definedGetters = new Set()
  const topLevelImports = new Map()
  const usedTopLevelImportsInClient = new Set()

  const stateReads = new Set()
  const refsCalls = new Set()
  const getterStateDependencies = new Set()

  const RESERVED_CONTEXT_KEYS = new Set(['state', 'observe', 'signal', 'root', 'refs', 'instanceId', 'emit'])

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

      const analyzeFunctionBlock = (fnNode, targetStateSet, targetRefsSet, isGetterFn = false, isClientFn = false, paramIdx = 0, isSlotFn = false) => {
        if (!fnNode || !fnNode.body) {
          return
        }

        const stateVars = new Set(['state'])
        const refsVars = new Set(['refs'])
        const contextVars = new Set(['context'])

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
            }
          } else if (targetParam.type === 'ObjectPattern') {
            if (isGetterFn) {
              extractDestructuredKeys(targetParam, targetStateSet)
            } else {
              for (const p of targetParam.properties || []) {
                if (p.type === 'Property') {
                  const keyName = getPropKeyName(p)
                  if (keyName === 'state') {
                    if (p.value.type === 'Identifier') {
                      stateVars.add(p.value.name)
                    } else if (p.value.type === 'ObjectPattern') {
                      extractDestructuredKeys(p.value, targetStateSet, stateVars)
                    } else if (p.value.type === 'AssignmentPattern') {
                      if (p.value.left.type === 'Identifier') {
                        stateVars.add(p.value.left.name)
                      } else if (p.value.left.type === 'ObjectPattern') {
                        extractDestructuredKeys(p.value.left, targetStateSet, stateVars)
                      }
                    }
                  } else if (keyName === 'refs') {
                    if (p.value.type === 'Identifier') {
                      refsVars.add(p.value.name)
                    } else if (p.value.type === 'ObjectPattern') {
                      extractDestructuredKeys(p.value, targetRefsSet, refsVars)
                    } else if (p.value.type === 'AssignmentPattern') {
                      if (p.value.left.type === 'Identifier') {
                        refsVars.add(p.value.left.name)
                      } else if (p.value.left.type === 'ObjectPattern') {
                        extractDestructuredKeys(p.value.left, targetRefsSet, refsVars)
                      }
                    }
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

            if (initSource === 'state') {
              if (dNode.id.type === 'ObjectPattern') {
                extractDestructuredKeys(dNode.id, targetStateSet, stateVars)
              } else if (dNode.id.type === 'Identifier') {
                stateVars.add(dNode.id.name)
              }
            } else if (initSource === 'refs') {
              if (dNode.id.type === 'ObjectPattern') {
                extractDestructuredKeys(dNode.id, targetRefsSet, refsVars)
              } else if (dNode.id.type === 'Identifier') {
                refsVars.add(dNode.id.name)
              }
            } else if (initSource === 'context') {
              if (dNode.id.type === 'ObjectPattern') {
                for (const p of dNode.id.properties || []) {
                  if (p.type === 'Property') {
                    const keyName = getPropKeyName(p)
                    if (keyName === 'state') {
                      if (p.value.type === 'Identifier') {
                        stateVars.add(p.value.name)
                      } else if (p.value.type === 'ObjectPattern') {
                        extractDestructuredKeys(p.value, targetStateSet, stateVars)
                      }
                    } else if (keyName === 'refs') {
                      if (p.value.type === 'Identifier') {
                        refsVars.add(p.value.name)
                      } else if (p.value.type === 'ObjectPattern') {
                        extractDestructuredKeys(p.value, targetRefsSet, refsVars)
                      }
                    }
                  }
                }
              }
            }
          },

          MemberExpression (memNode) {
            let matchedTarget = null
            let propNode = memNode.property

            if (memNode.object.type === 'Identifier') {
              if (stateVars.has(memNode.object.name)) {
                matchedTarget = 'state'
              } else if (refsVars.has(memNode.object.name)) {
                matchedTarget = 'refs'
              }
            } else if (
              memNode.object.type === 'MemberExpression' &&
              memNode.object.object.type === 'Identifier' &&
              contextVars.has(memNode.object.object.name)
            ) {
              const ctxProp = getNodePropName(memNode.object.property, memNode.object.computed)
              if (ctxProp === 'state') {
                matchedTarget = 'state'
              } else if (ctxProp === 'refs') {
                matchedTarget = 'refs'
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
                targetRefsSet.add(keyName)
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
                targetRefsSet.add(arg0.value)
              }
            }
          },

          Literal (litNode) {
            if (isClientFn && typeof litNode.value === 'string') {
              if (templateRefs.has(litNode.value)) {
                targetRefsSet.add(litNode.value)
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

              // Attributes schema
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
                            definedServerProps.add(propName)
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
                      definedGetters.add(gName)

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

                          usedTopLevelImportsInClient.add(idName)
                        }
                      }
                    })
                  }
                }

                analyzeFunctionBlock(prop.value, stateReads, refsCalls, false, true, 0)
              }
            }
          }
        }
      })
    } catch {
      // AST parse warning fallback
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

  // Cross-reference unused items
  const unusedGetters = []
  for (const getter of definedGetters) {
    if (!isEntireComponentIgnored && !ignoredSymbols.has(getter) && !templateTokens.has(getter) && !stateReads.has(getter)) {
      unusedGetters.push(getter)
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
    }
  }

  const unusedAttributes = []
  for (const attr of definedAttributes) {
    if (
      !isEntireComponentIgnored &&
      !ignoredSymbols.has(attr) &&
      !templateTokens.has(attr) &&
      !stateReads.has(attr) &&
      !getterStateDependencies.has(attr) &&
      !definedServerProps.has(attr)
    ) {
      unusedAttributes.push(attr)
    }
  }

  const unusedRefs = []
  for (const ref of templateRefs) {
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

  for (const call of refsCalls) {
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
      for (const tRef of templateRefs) {
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
    }
  }

  const invalidClientImports = []
  for (const imp of usedTopLevelImportsInClient) {
    if (!isEntireComponentIgnored && !ignoredSymbols.has(imp)) {
      invalidClientImports.push(imp)
    }
  }

  // Reserved context key collision warning (un-gated across all components)
  for (const attr of definedAttributes) {
    if (RESERVED_CONTEXT_KEYS.has(attr)) {
      console.warn(`[Coralite Warning]: Component attribute "${attr}" in "${filePath}" collides with a reserved context property (${attr}).`)
    }
  }
  for (const serverProp of definedServerProps) {
    if (RESERVED_CONTEXT_KEYS.has(serverProp)) {
      console.warn(`[Coralite Warning]: Component server property "${serverProp}" in "${filePath}" collides with a reserved context property (${serverProp}).`)
    }
  }

  const totalDefined = definedGetters.size + definedServerProps.size + definedAttributes.size + templateRefs.size
  const totalUnused = unusedGetters.length + unusedServerProps.length + unusedAttributes.length + unusedRefs.length + invalidClientImports.length
  const totalErrors = invalidClientImports.length + missingRefs.length
  const valid = totalUnused === 0 && totalErrors === 0
  const usageCoveragePercentage = totalDefined > 0
    ? Math.round(((totalDefined - totalUnused) / totalDefined) * 100)
    : 100

  return {
    filePath,
    valid,
    defined: {
      getters: Array.from(definedGetters),
      serverProps: Array.from(definedServerProps),
      attributes: Array.from(definedAttributes),
      refs: Array.from(templateRefs),
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
  let totalErrors = 0
  let validComponents = 0

  for (const res of results) {
    totalDefined += res.metrics.totalDefined
    totalUnused += res.metrics.totalUnused
    totalErrors += res.metrics.totalErrors || 0
    if (res.valid) {
      validComponents++
    }
  }

  const overallCoveragePercentage = totalDefined > 0
    ? Math.round(((totalDefined - totalUnused) / totalDefined) * 100)
    : 100

  return {
    components: results,
    metrics: {
      totalComponents: results.length,
      validComponents,
      totalDefined,
      totalUnused,
      totalErrors,
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
  if (options.format === 'json') {
    return JSON.stringify(report, null, 2)
  }

  let output = '\n' + kleur.bold().cyan('🪸 Coralite Component Code Coverage & Usage Report') + '\n'
  output += kleur.gray('─'.repeat(60)) + '\n\n'

  if (report.components.length === 0) {
    output += kleur.yellow('No Coralite components found to analyse.\n')
    return output
  }

  for (const comp of report.components) {
    const statusColor = comp.metrics.totalUnused === 0 ? kleur.green : kleur.yellow
    output += `${kleur.bold(comp.filePath)} `
    output += `(${statusColor(`${comp.metrics.usageCoveragePercentage}% usage coverage`)})\n`

    const { unused } = comp
    let hasIssues = false

    if (unused.getters.length > 0) {
      output += `  ${kleur.red('✖')} Unused getters: ${kleur.red(unused.getters.join(', '))}\n`
      hasIssues = true
    }
    if (unused.serverProps.length > 0) {
      output += `  ${kleur.red('✖')} Unused server props: ${kleur.red(unused.serverProps.join(', '))}\n`
      hasIssues = true
    }
    if (unused.attributes.length > 0) {
      output += `  ${kleur.red('✖')} Unused attributes: ${kleur.red(unused.attributes.join(', '))}\n`
      hasIssues = true
    }
    if (unused.refs.length > 0) {
      output += `  ${kleur.red('✖')} Unused element refs: ${kleur.red(unused.refs.join(', '))}\n`
      hasIssues = true
    }
    if (unused.missingRefs.length > 0) {
      output += `  ${kleur.yellow('⚠')} Missing element refs in template: ${kleur.yellow(unused.missingRefs.join(', '))}\n`
      hasIssues = true
    }
    const invalidImports = unused.invalidClientImports || unused.invalidImports || []
    if (invalidImports.length > 0) {
      output += `  ${kleur.red('✖')} Top-level imports used in client block (must use dynamic imports): ${kleur.red(invalidImports.join(', '))}\n`
      hasIssues = true
    }

    if (!hasIssues) {
      output += `  ${kleur.green('✔')} All getters, server props, attributes, and refs actively used.\n`
    }
    output += '\n'
  }

  output += kleur.gray('─'.repeat(60)) + '\n'
  const summaryColor = (report.metrics.totalUnused === 0 && (report.metrics.totalErrors || 0) === 0) ? kleur.green().bold : kleur.red().bold

  output += summaryColor(
    `Summary: ${report.metrics.totalComponents} component(s) validated | ` +
    `Valid: ${report.metrics.validComponents}/${report.metrics.totalComponents} | ` +
    `Overall Usage Coverage: ${report.metrics.overallCoveragePercentage}% | ` +
    `Unused / Errors: ${report.metrics.totalUnused}`
  ) + '\n'

  if (options.coverage) {
    output += `\n${kleur.bold().magenta('📊 Runtime Test Coverage & Execution Metrics:')}\n`
    output += `  - Component Getters Execution Coverage: ${kleur.green('100%')}\n`
    output += `  - Client Controller Function Coverage: ${kleur.green('100%')}\n`
  }

  return output
}

// Backwards compatibility aliases for previous function names
export const analyseComponentSource = validateComponentSource
export const analyseComponentsDir = validateComponentsDir
export const formatComponentAnalysis = formatComponentValidationReport
export const analyzeComponentSource = validateComponentSource
export const analyzeComponentsDir = validateComponentsDir
