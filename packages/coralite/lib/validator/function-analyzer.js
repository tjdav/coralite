import { simple as walkJS } from 'acorn-walk'
import { camelToKebab, kebabToCamel } from '../utils/core.js'
import {
  RESERVED_CONTEXT_KEYS,
  getPropKeyName,
  getNodePropName,
  extractDestructuredKeys,
  createDiagnostic
} from './helpers.js'

/**
 * Analyzes a function AST block (getters, server functions, slot functions, client function, observe callbacks)
 * for state reads, ref calls, property destructuring, context.attributes misuses, and observe state mutations.
 *
 * @param {object} fnNode - AST function node (FunctionExpression, ArrowFunctionExpression, FunctionDeclaration)
 * @param {Set<string>} targetStateSet - Set where accessed state/getter property names are recorded
 * @param {Map<string, object>} targetRefsMap - Map where called ref names and location objects are recorded
 * @param {boolean} isGetterFn - True if analyzing a getter function
 * @param {boolean} isClientFn - True if analyzing client() function
 * @param {number} paramIdx - Parameter index receiving state/context (0 or 1)
 * @param {boolean} isSlotFn - True if analyzing a slot function
 * @param {boolean} isServerFn - True if analyzing a server function
 * @param {object} context - ValidationContext instance
 */
export function analyzeFunctionBlock (
  fnNode,
  targetStateSet,
  targetRefsMap,
  isGetterFn,
  isClientFn,
  paramIdx,
  isSlotFn,
  isServerFn,
  context,
  isStyleFn = false
) {
  if (!fnNode || !fnNode.body) {
    return
  }

  const { diagnostics, filePath, scriptStartLine, sourceCode, templateRefs } = context

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
      if (isStyleFn) {
        stateVars.add(targetParam.name)
      } else if (isGetterFn) {
        if (targetParam.name === 'state') {
          diagnostics.push(createDiagnostic({
            code: 'CORALITE-E105',
            severity: 'error',
            message: 'Getter function parameter receives CoraliteGetterContext ({ state, root, refs, slots, signal }). Destructure { state } or context parameter instead of (state).',
            filePath,
            line: targetParam.loc ? targetParam.loc.start.line + scriptStartLine : 1,
            column: targetParam.loc ? targetParam.loc.start.column + 1 : 1,
            sourceCode,
            cause: 'Getter functions in Coralite receive context ({ state, root, refs, slots, signal }) instead of state directly.',
            fix: {
              action: 'rewrite_getter_context',
              description: 'Rewrite getter parameter to destructured ({ state })'
            }
          }))
          stateVars.add('state')
        } else {
          contextVars.add(targetParam.name)
        }
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
      if (isStyleFn) {
        extractDestructuredKeys(targetParam, targetStateSet)
      } else if (isGetterFn) {
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
                      line: refProp.loc.start.line + scriptStartLine,
                      column: refProp.loc.start.column + 1
                    })
                  }
                }
              }
            } else if (keyName === 'root' || keyName === 'slots' || keyName === 'signal') {
              // Recognized context properties
            } else if (keyName) {
              targetStateSet.add(keyName)
            }
          }
        }
      } else {
        for (const p of targetParam.properties || []) {
          if (p.type === 'Property') {
            const keyName = getPropKeyName(p)
            if ((isServerFn || isClientFn) && keyName === 'attributes') {
              diagnostics.push(createDiagnostic({
                code: 'CORALITE-E105',
                severity: 'error',
                message: "Invalid access to 'context.attributes'. Component attributes are exposed directly on 'context.state'.",
                filePath,
                line: p.loc.start.line + scriptStartLine,
                column: p.loc.start.column + 1,
                sourceCode,
                cause: 'Attributes are parsed and applied directly to context.state (or destructured { state }) in Coralite.',
                fix: {
                  action: 'rewrite_context_attributes',
                  description: "Replace 'context.attributes' with 'context.state'"
                }
              }))
            }
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
                      line: refProp.loc.start.line + scriptStartLine,
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
                line: refProp.loc.start.line + scriptStartLine,
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
              if ((isServerFn || isClientFn) && keyName === 'attributes') {
                diagnostics.push(createDiagnostic({
                  code: 'CORALITE-E105',
                  severity: 'error',
                  message: "Invalid access to 'context.attributes'. Component attributes are exposed directly on 'context.state'.",
                  filePath,
                  line: p.loc.start.line + scriptStartLine,
                  column: p.loc.start.column + 1,
                  sourceCode,
                  cause: 'Attributes are parsed and applied directly to context.state (or destructured { state }) in Coralite.',
                  fix: {
                    action: 'rewrite_context_attributes',
                    description: "Replace 'context.attributes' with 'context.state'"
                  }
                }))
              }
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
                        line: refProp.loc.start.line + scriptStartLine,
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
      const propNode = memNode.property

      if (memNode.object.type === 'Identifier') {
        if (errorsVars.has(memNode.object.name)) {
          matchedTarget = 'errors'
        } else if (stateVars.has(memNode.object.name)) {
          matchedTarget = 'state'
        } else if (refsVars.has(memNode.object.name)) {
          matchedTarget = 'refs'
        } else if (contextVars.has(memNode.object.name)) {
          const ctxPropName = getNodePropName(propNode, memNode.computed)
          if ((isServerFn || isClientFn) && ctxPropName === 'attributes') {
            diagnostics.push(createDiagnostic({
              code: 'CORALITE-E105',
              severity: 'error',
              message: "Invalid access to 'context.attributes'. Component attributes are exposed directly on 'context.state'.",
              filePath,
              line: memNode.loc.start.line + scriptStartLine,
              column: memNode.loc.start.column + 1,
              sourceCode,
              cause: 'Attributes are parsed and applied directly to context.state (or destructured { state }) in Coralite.',
              fix: {
                action: 'rewrite_context_attributes',
                description: "Replace 'context.attributes' with 'context.state'"
              }
            }))
          }
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
        let refVal = null
        if (arg0.type === 'Literal' && typeof arg0.value === 'string') {
          refVal = arg0.value
        } else if (arg0.type === 'TemplateLiteral' && arg0.quasis && arg0.quasis.length === 1) {
          refVal = arg0.quasis[0].value.cooked ?? arg0.quasis[0].value.raw
        }
        if (refVal) {
          targetRefsMap.set(refVal, {
            line: callNode.loc.start.line + scriptStartLine,
            column: callNode.loc.start.column + 1
          })
        }
      }

      // CORALITE-E302: Check for observe() state mutations
      const isObserveCall =
        (callNode.callee.type === 'Identifier' && callNode.callee.name === 'observe') ||
        (callNode.callee.type === 'MemberExpression' && getNodePropName(callNode.callee.property, callNode.callee.computed) === 'observe')

      if (isObserveCall && callNode.arguments.length > 0) {
        const targetArg = callNode.arguments[0]
        if (targetArg.type === 'Literal' && typeof targetArg.value === 'string') {
          targetStateSet.add(targetArg.value)
        } else if (targetArg.type === 'TemplateLiteral' && targetArg.quasis && targetArg.quasis.length === 1) {
          const val = targetArg.quasis[0].value.cooked ?? targetArg.quasis[0].value.raw
          if (val) {
            targetStateSet.add(val)
          }
        } else if (targetArg.type === 'ArrayExpression') {
          for (const el of targetArg.elements) {
            if (el) {
              if (el.type === 'Literal' && typeof el.value === 'string') {
                targetStateSet.add(el.value)
              } else if (el.type === 'TemplateLiteral' && el.quasis && el.quasis.length === 1) {
                const val = el.quasis[0].value.cooked ?? el.quasis[0].value.raw
                if (val) {
                  targetStateSet.add(val)
                }
              }
            }
          }
        }

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
                  line: locNode.loc.start.line + scriptStartLine,
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

    Property (propNode) {
      if (isClientFn) {
        const keyName = getPropKeyName(propNode)
        if (keyName && templateRefs.has(keyName)) {
          const targetNode = propNode.key || propNode
          targetRefsMap.set(keyName, {
            line: targetNode.loc.start.line + scriptStartLine,
            column: targetNode.loc.start.column + 1
          })
        }
      }
    }
  })
}
