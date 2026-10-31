import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import { kebabToCamel } from '../../../shared/core.js'
import {
  ALLOWED_COMPONENT_CONFIG_KEYS,
  TOP_LEVEL_CONFIG_KEYS,
  getPropKeyName,
  createDiagnostic
} from '../helpers.js'

const ALLOWED_PAGE_CONFIG_KEYS = new Set([
  'paths',
  'server',
  'getters',
  'style',
  'provide',
  'client',
  'onError'
])

const REJECTED_PAGE_CONFIG_KEYS = {
  attributes: 'definePage does not support "attributes". Use "server" to fetch page data.',
  slots: 'definePage does not support "slots". Pages are the outermost layer.',
  consume: 'definePage does not support "consume". Pages are the root provider — use "provide".',
  formAssociated: 'definePage does not support "formAssociated". Use a form-associated component instead.'
}

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

  let hasDefinePageCall = false
  let hasBarePageExports = false
  let bareExportLoc = null

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

      if (blockNode.type === 'Identifier') {
        const idName = blockNode.name
        if (topLevelImports.has(idName) && topLevelImports.get(idName) !== 'local') {
          usedTopLevelImportsOutsideClient.add(idName)
        }
        return
      }

      walkAncestorJS(blockNode, {
        Identifier (idNode, ancestors) {
          const idName = idNode.name
          if (topLevelImports.has(idName) && topLevelImports.get(idName) !== 'local') {
            const parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : null
            if (parent) {
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
          if (tplNode.quasis) {
            const fullStr = tplNode.quasis
              .map((elem, idx) => (elem.value?.raw || '') + (tplNode.expressions?.[idx] ? '${...}' : ''))
              .join('')
            scriptStringPool.push(fullStr)
            for (const elem of tplNode.quasis) {
              if (elem.value && elem.value.raw) {
                scriptStringPool.push(elem.value.raw)
              }
            }
          }
        }
      })

      for (const node of ast.body) {
        if (node.type === 'ExportNamedDeclaration') {
          const isComponent = context.sourceCode.includes('<template')
          if (node.declaration) {
            if (node.declaration.type === 'VariableDeclaration') {
              for (const decl of node.declaration.declarations) {
                if (decl.id && decl.id.type === 'Identifier') {
                  if (decl.id.name === 'paths' || (!isComponent && decl.id.name === 'server')) {
                    hasBarePageExports = true
                    bareExportLoc = decl.loc
                  }
                }
              }
            } else if (node.declaration.type === 'FunctionDeclaration') {
              if (node.declaration.id && (node.declaration.id.name === 'paths' || (!isComponent && node.declaration.id.name === 'server'))) {
                hasBarePageExports = true
                bareExportLoc = node.declaration.id.loc
              }
            }
          }
          if (node.specifiers) {
            for (const spec of node.specifiers) {
              let exportedName = ''
              if (spec.exported) {
                exportedName = spec.exported.type === 'Identifier' ? spec.exported.name : String(spec.exported.value)
              } else if (spec.local) {
                exportedName = spec.local.type === 'Identifier' ? spec.local.name : String(spec.local.value)
              }
              if (exportedName === 'paths' || (!isComponent && exportedName === 'server')) {
                hasBarePageExports = true
                bareExportLoc = spec.loc
              }
            }
          }
        }

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

    const processComponentProperty = (keyName, prop) => {
      if (keyName === 'formAssociated' || keyName === 'formControl') {
        if (!prop.value || prop.value.type !== 'Literal' || typeof prop.value.value !== 'boolean') {
          const targetNode = prop.value || prop
          const line = targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1
          const column = targetNode.loc ? targetNode.loc.start.column + 1 : 1
          context.diagnostics.push(createDiagnostic({
            code: 'CORALITE-E107',
            severity: 'error',
            message: `Component option '${keyName}' must be a boolean.`,
            filePath: context.filePath,
            line,
            column,
            sourceCode: context.sourceCode,
            cause: `'${keyName}' option must be a boolean literal (true or false).`
          }))
        }
      }

      if (keyName === 'listStrategy') {
        if (prop.value && prop.value.type === 'Literal') {
          if (prop.value.value !== 'full' && prop.value.value !== 'minimal') {
            const targetNode = prop.value || prop
            const line = targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1
            const column = targetNode.loc ? targetNode.loc.start.column + 1 : 1
            context.diagnostics.push(createDiagnostic({
              code: 'CORALITE-E107',
              severity: 'error',
              message: "Component option 'listStrategy' must be 'full', 'minimal', or an object.",
              filePath: context.filePath,
              line,
              column,
              sourceCode: context.sourceCode,
              cause: "'listStrategy' must be 'full', 'minimal', or an object with mode and key."
            }))
          }
        }
      }

      if (keyName === 'onError') {
        const val = prop.value
        const isValidFn = val && (val.type === 'FunctionExpression' || val.type === 'ArrowFunctionExpression' || val.type === 'FunctionDeclaration' || val.type === 'Identifier')
        if (!isValidFn) {
          const targetNode = prop.value || prop
          const line = targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1
          const column = targetNode.loc ? targetNode.loc.start.column + 1 : 1
          context.diagnostics.push(createDiagnostic({
            code: 'CORALITE-E107',
            severity: 'error',
            message: "Component option 'onError' must be a function.",
            filePath: context.filePath,
            line,
            column,
            sourceCode: context.sourceCode,
            cause: "'onError' error boundary option must be a function."
          }))
        }
      }

      if (TOP_LEVEL_CONFIG_KEYS.has(keyName)) {
        collectTopLevelImportsOutsideClient(prop.value)
      }

      if (keyName === 'state') {
        context.hasStateBlock = true
        if (prop.value && prop.value.type === 'ObjectExpression') {
          for (const sProp of prop.value.properties) {
            if (sProp.type === 'Property') {
              if (sProp.computed) {
                context.hasUnresolvableState = true
              } else {
                const sName = getPropKeyName(sProp)
                if (sName) {
                  context.definedStateProps.add(sName)
                  context.definedStateProps.add(kebabToCamel(sName))
                } else {
                  context.hasUnresolvableState = true
                }
              }
            } else {
              context.hasUnresolvableState = true
            }
          }
        } else {
          context.hasUnresolvableState = true
        }
      }

      if (keyName === 'attributes' && prop.value && prop.value.type === 'ObjectExpression') {
        for (const attrProp of prop.value.properties) {
          if (attrProp.type === 'Property') {
            const attrName = getPropKeyName(attrProp)
            if (attrName) {
              definedAttributes.add(attrName)
              definedAttributes.add(kebabToCamel(attrName))
            }
          }
        }
      }

      if (keyName === 'consume' && prop.value) {
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

      if (keyName === 'server') {
        context.hasServerBlock = true
        if (
          prop.value &&
          (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression' || prop.value.type === 'FunctionDeclaration')
        ) {
          let hasReturn = false
          walkJS(prop.value.body, {
            ReturnStatement (retNode) {
              hasReturn = true
              if (retNode.argument && retNode.argument.type === 'ObjectExpression') {
                for (const retProp of retNode.argument.properties) {
                  if (retProp.type === 'Property') {
                    if (retProp.computed) {
                      context.hasUnresolvableServer = true
                    } else {
                      const propName = getPropKeyName(retProp)
                      if (propName) {
                        definedServerProps.add(propName)
                        definedServerProps.add(kebabToCamel(propName))
                        const targetNode = retProp.key || retProp
                        serverPropLocations.set(propName, {
                          line: targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1,
                          column: targetNode.loc ? targetNode.loc.start.column + 1 : 1
                        })
                      } else {
                        context.hasUnresolvableServer = true
                      }
                    }
                  } else {
                    context.hasUnresolvableServer = true
                  }
                }
              } else {
                context.hasUnresolvableServer = true
              }
            }
          })
          if (!hasReturn) {
            context.hasUnresolvableServer = true
          }
        } else {
          context.hasUnresolvableServer = true
        }
      }

      if (keyName === 'getters' && prop.value && prop.value.type === 'ObjectExpression') {
        for (const getterProp of prop.value.properties) {
          if (getterProp.type === 'Property') {
            const gName = getPropKeyName(getterProp)
            if (gName) {
              definedGetters.add(gName)
              const targetNode = getterProp.key || getterProp
              getterLocations.set(gName, {
                line: targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1,
                column: targetNode.loc ? targetNode.loc.start.column + 1 : 1
              })
            }
          }
        }
      }

      if (keyName === 'slots' && prop.value && prop.value.type === 'ObjectExpression') {
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

    walkAncestorJS(ast, {
      CallExpression (node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'definePage' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'ObjectExpression'
        ) {
          hasDefinePageCall = true
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

            if (REJECTED_PAGE_CONFIG_KEYS[keyName]) {
              const targetNode = prop.key || prop
              const line = targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1
              const column = targetNode.loc ? targetNode.loc.start.column + 1 : 1
              context.diagnostics.push(createDiagnostic({
                code: 'CORALITE-E107',
                severity: 'error',
                message: REJECTED_PAGE_CONFIG_KEYS[keyName],
                filePath: context.filePath,
                line,
                column,
                sourceCode: context.sourceCode,
                cause: REJECTED_PAGE_CONFIG_KEYS[keyName]
              }))
            } else if (!ALLOWED_PAGE_CONFIG_KEYS.has(keyName)) {
              const targetNode = prop.key || prop
              const line = targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1
              const column = targetNode.loc ? targetNode.loc.start.column + 1 : 1
              context.diagnostics.push(createDiagnostic({
                code: 'CORALITE-E107',
                severity: 'error',
                message: `Unknown block "${keyName}" in definePage. Valid blocks are: paths, server, getters, style, provide, client, onError.`,
                filePath: context.filePath,
                line,
                column,
                sourceCode: context.sourceCode,
                cause: `Unknown block "${keyName}" in definePage.`
              }))
            }



            if (keyName === 'server') {
              context.hasServerBlock = true
              if (
                prop.value &&
                (prop.value.type === 'FunctionExpression' || prop.value.type === 'ArrowFunctionExpression')
              ) {
                let hasReturn = false
                walkJS(prop.value.body, {
                  ReturnStatement (retNode) {
                    hasReturn = true
                    if (retNode.argument && retNode.argument.type === 'ObjectExpression') {
                      for (const retProp of retNode.argument.properties) {
                        if (retProp.type === 'Property') {
                          if (retProp.computed) {
                            context.hasUnresolvableServer = true
                          } else {
                            const propName = getPropKeyName(retProp)
                            if (propName) {
                              definedServerProps.add(propName)
                              definedServerProps.add(kebabToCamel(propName))
                              const targetNode = retProp.key || retProp
                              serverPropLocations.set(propName, {
                                line: targetNode.loc.start.line + scriptStartLine,
                                column: targetNode.loc.start.column + 1
                              })
                            } else {
                              context.hasUnresolvableServer = true
                            }
                          }
                        } else {
                          context.hasUnresolvableServer = true
                        }
                      }
                    } else {
                      context.hasUnresolvableServer = true
                    }
                  }
                })
                if (!hasReturn) {
                  context.hasUnresolvableServer = true
                }
              } else {
                context.hasUnresolvableServer = true
              }
            }

          }
        }

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

            if (!ALLOWED_COMPONENT_CONFIG_KEYS.has(keyName)) {
              const targetNode = prop.key || prop
              const line = targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1
              const column = targetNode.loc ? targetNode.loc.start.column + 1 : 1
              let message = `Unknown block "${keyName}" in defineComponent. Valid blocks are: ${Array.from(ALLOWED_COMPONENT_CONFIG_KEYS).join(', ')}.`
              let cause = `Unknown block "${keyName}" in defineComponent.`
              if (keyName === 'state') {
                message = "Component specifies deprecated top-level 'state'. Declare reactive state via 'attributes' schema or initialize in async server() block."
                cause = "Top-level 'state' is deprecated in Coralite."
              }
              context.diagnostics.push(createDiagnostic({
                code: 'CORALITE-E107',
                severity: 'error',
                message,
                filePath: context.filePath,
                line,
                column,
                sourceCode: context.sourceCode,
                cause
              }))
            }

            processComponentProperty(keyName, prop)
          }
        }
      }
    })

    if (!context.configObj && ast && Array.isArray(ast.body)) {
      const topLevelBindings = new Map()
      for (const node of ast.body) {
        if (node.type === 'VariableDeclaration') {
          for (const decl of node.declarations) {
            if (decl.id?.type === 'Identifier' && decl.init) {
              topLevelBindings.set(decl.id.name, {
                node: decl.init,
                kind: node.kind,
                loc: decl.loc
              })
            }
          }
        } else if (node.type === 'FunctionDeclaration' && node.id?.name) {
          topLevelBindings.set(node.id.name, {
            node,
            kind: 'function',
            loc: node.loc
          })
        }
      }

      for (const node of ast.body) {
        if (node.type === 'ExportNamedDeclaration') {
          if (node.declaration) {
            if (node.declaration.type === 'FunctionDeclaration') {
              const exportName = node.declaration.id?.name
              if (exportName && ALLOWED_COMPONENT_CONFIG_KEYS.has(exportName)) {
                if (exportName !== 'server' && exportName !== 'client' && exportName !== 'onError') {
                  const targetNode = node.declaration.id || node.declaration
                  context.diagnostics.push(createDiagnostic({
                    code: 'CORALITE-E107',
                    severity: 'error',
                    message: `Component declaration "${exportName}" must use "export const", not "export function".`,
                    filePath: context.filePath,
                    line: targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1,
                    column: targetNode.loc ? targetNode.loc.start.column + 1 : 1,
                    sourceCode: context.sourceCode,
                    cause: `Declaration data "${exportName}" must be declared using export const.`
                  }))
                }
                const prop = {
                  type: 'Property',
                  key: node.declaration.id,
                  value: node.declaration,
                  loc: node.declaration.loc,
                  kind: 'init'
                }
                context.configProps.set(exportName, prop)
                processComponentProperty(exportName, prop)
              }
            } else if (node.declaration.type === 'VariableDeclaration') {
              for (const decl of node.declaration.declarations) {
                const exportName = decl.id?.type === 'Identifier' ? decl.id.name : null
                if (exportName && ALLOWED_COMPONENT_CONFIG_KEYS.has(exportName)) {
                  if (exportName === 'server' || exportName === 'client' || exportName === 'onError') {
                    const targetNode = decl.id || decl
                    context.diagnostics.push(createDiagnostic({
                      code: 'CORALITE-E107',
                      severity: 'error',
                      message: `Component handler "${exportName}" must use "export function", not "export const".`,
                      filePath: context.filePath,
                      line: targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1,
                      column: targetNode.loc ? targetNode.loc.start.column + 1 : 1,
                      sourceCode: context.sourceCode,
                      cause: `Handler function "${exportName}" must be declared using export function.`
                    }))
                  } else if (node.declaration.kind !== 'const') {
                    const targetNode = decl.id || decl
                    context.diagnostics.push(createDiagnostic({
                      code: 'CORALITE-E107',
                      severity: 'error',
                      message: `Component declaration "${exportName}" must use "export const".`,
                      filePath: context.filePath,
                      line: targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1,
                      column: targetNode.loc ? targetNode.loc.start.column + 1 : 1,
                      sourceCode: context.sourceCode,
                      cause: `Declaration data "${exportName}" must be declared using export const.`
                    }))
                  }
                  const prop = {
                    type: 'Property',
                    key: decl.id,
                    value: decl.init,
                    loc: decl.loc,
                    kind: 'init'
                  }
                  context.configProps.set(exportName, prop)
                  processComponentProperty(exportName, prop)
                }
              }
            }
          } else if (node.specifiers) {
            for (const spec of node.specifiers) {
              let exportName = ''
              if (spec.exported?.type === 'Identifier') {
                exportName = spec.exported.name
              } else if (spec.exported?.value) {
                exportName = String(spec.exported.value)
              }
              if (exportName && ALLOWED_COMPONENT_CONFIG_KEYS.has(exportName)) {
                let localName = ''
                if (spec.local?.type === 'Identifier') {
                  localName = spec.local.name
                } else if (spec.local?.value) {
                  localName = String(spec.local.value)
                }
                const target = topLevelBindings.get(localName)
                if (target) {
                  const prop = {
                    type: 'Property',
                    key: spec.exported || spec.local,
                    value: target.node,
                    loc: spec.loc,
                    kind: 'init'
                  }
                  context.configProps.set(exportName, prop)
                  processComponentProperty(exportName, prop)
                }
              }
            }
          }
        }
      }

      if (context.configProps.size > 0) {
        context.configObj = {
          type: 'ObjectExpression',
          properties: Array.from(context.configProps.values())
        }
      }
    }

    if (hasBarePageExports && !hasDefinePageCall) {
      const line = bareExportLoc ? bareExportLoc.start.line + scriptStartLine : scriptStartLine + 1
      const column = bareExportLoc ? bareExportLoc.start.column + 1 : 1
      context.diagnostics.push(createDiagnostic({
        code: 'CORALITE-E108',
        severity: 'error',
        message: 'Page uses the deprecated bare-export shape. Use export default definePage({ ... }) instead.',
        filePath: context.filePath,
        line,
        column,
        sourceCode: context.sourceCode,
        cause: 'Page uses deprecated bare exports ("paths", "server"). Use export default definePage({ ... }) instead.',
        fix: {
          action: 'migrate_bare_exports',
          description: 'Convert bare exports to definePage({ ... })'
        }
      }))
    }
  } catch {
    // Fallback for invalid script syntax
  }
}
