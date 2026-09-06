import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import {
  getPropKeyName,
  getNodePropName,
  createDiagnostic
} from '../helpers.js'
import { analyzeFunctionBlock } from '../function-analyzer.js'

/**
 * Pass 9: Client block validation.
 * Validates client() function for serialization leaks (CORALITE-E301), redundant ref existence guards (CORALITE-W204),
 * observe state mutations (CORALITE-E302), and collects ref calls.
 *
 * @param {object} context - ValidationContext instance
 */
export function validateClientBlock (context) {
  const {
    configProps,
    topLevelImports,
    usedTopLevelImportsInClient,
    usedTopLevelImportsOutsideClient,
    diagnostics,
    filePath,
    scriptStartLine,
    sourceCode,
    stateReads,
    refsCalls
  } = context

  const clientProp = configProps.get('client')
  if (!clientProp) {
    return
  }

  const fnNode = clientProp.value
  if (!fnNode || (fnNode.type !== 'FunctionExpression' && fnNode.type !== 'ArrowFunctionExpression')) {
    return
  }

  if (topLevelImports.size > 0 && fnNode) {
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

    if (fnNode.params) {
      for (const param of fnNode.params) {
        extractPatternNames(param)
      }
    }

    if (fnNode.body) {
      walkJS(fnNode.body, {
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

      walkAncestorJS(fnNode.body, {
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
                line: idNode.loc.start.line + scriptStartLine,
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

  const clientFnBody = 'body' in fnNode ? fnNode.body : null
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
            line: ifNode.loc.start.line + scriptStartLine,
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

  analyzeFunctionBlock(fnNode, stateReads, refsCalls, false, true, 0, false, false, context)
}
