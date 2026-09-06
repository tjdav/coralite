import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import { kebabToCamel } from '../../utils/core.js'
import {
  TOP_LEVEL_CONFIG_KEYS,
  getPropKeyName
} from '../helpers.js'

/**
 * Pass 1: Single Acorn AST parse of script content.
 * Discovers top-level imports, local declarations, locates defineComponent config object,
 * indexes config object properties into context.configProps Map, pre-populates defined keys,
 * and scans top-level imports used outside client().
 *
 * @param {object} context - ValidationContext instance
 */
export function parseScriptAST (context) {
  const {
    scriptContent,
    scriptStartLine,
    scriptStringPool,
    topLevelImports,
    importLocations,
    usedTopLevelImportsOutsideClient,
    definedAttributes,
    definedServerProps,
    definedConsumedKeys,
    definedGetters,
    definedSlots,
    getterLocations,
    serverPropLocations
  } = context

  if (!scriptContent) {
    return
  }

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
            line: patternNode.loc.start.line + scriptStartLine,
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
      walkJS(ast, {
        Literal (litNode) {
          if (typeof litNode.value === 'string') {
            scriptStringPool.push(litNode.value)
          }
        },
        TemplateLiteral (tplNode) {
          for (const elem of tplNode.quasis || []) {
            if (elem.value && elem.value.raw) {
              scriptStringPool.push(elem.value.raw)
            }
          }
        }
      })

      for (const node of ast.body) {
        if (node.type === 'ImportDeclaration') {
          const source = node.source ? node.source.value : ''
          for (const spec of node.specifiers || []) {
            if (spec.local && spec.local.name) {
              topLevelImports.set(spec.local.name, source)
              importLocations.set(spec.local.name, {
                line: spec.loc.start.line + scriptStartLine,
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
          context.configObj = configObj

          for (const prop of configObj.properties) {
            if (prop.type !== 'Property') {
              continue
            }
            const keyName = getPropKeyName(prop)
            if (!keyName) {
              continue
            }

            context.configProps.set(keyName, prop)

            if (TOP_LEVEL_CONFIG_KEYS.has(keyName)) {
              collectTopLevelImportsOutsideClient(prop.value)
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

            if (keyName === 'consume') {
              if (prop.value.type === 'ArrayExpression') {
                for (const el of prop.value.elements) {
                  if (el && el.type === 'Literal' && typeof el.value === 'string') {
                    const keyStr = el.value
                    const camelKey = kebabToCamel(keyStr)
                    definedConsumedKeys.add(keyStr)
                    definedConsumedKeys.add(camelKey)
                    definedServerProps.add(keyStr)
                    definedServerProps.add(camelKey)
                  }
                }
              } else if (prop.value.type === 'ObjectExpression') {
                for (const cProp of prop.value.properties) {
                  if (cProp.type === 'Property') {
                    const cKey = getPropKeyName(cProp)
                    if (cKey) {
                      const camelKey = kebabToCamel(cKey)
                      definedConsumedKeys.add(cKey)
                      definedConsumedKeys.add(camelKey)
                      definedServerProps.add(cKey)
                      definedServerProps.add(camelKey)
                    }
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
                          const targetNode = retProp.key || retProp
                          serverPropLocations.set(propName, {
                            line: targetNode.loc.start.line + scriptStartLine,
                            column: targetNode.loc.start.column + 1
                          })
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
                    const targetNode = getterProp.key || getterProp
                    getterLocations.set(gName, {
                      line: targetNode.loc.start.line + scriptStartLine,
                      column: targetNode.loc.start.column + 1
                    })
                  }
                }
              }
            }

            if (keyName === 'slots' && prop.value.type === 'ObjectExpression') {
              for (const slotProp of prop.value.properties) {
                if (slotProp.type === 'Property') {
                  const slotName = getPropKeyName(slotProp)
                  if (slotName) {
                    definedSlots.add(slotName)
                  }
                }
              }
            }
          }
        }
      }
    })
  } catch {
    // Fallback for invalid script syntax
  }
}
