import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import { readFile, readdir, stat, access } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import kleur from 'kleur'
import { buildCodeframe } from './utils/diagnostics.js'

/**
 * @import {
 *   CoralitePluginValidationIssue,
 *   CoralitePluginValidationResult,
 *   CoralitePluginDirectoryValidationReport,
 *   CoraliteDiagnostic
 * } from '../types/index.js'
 */

const RESERVED_PLUGIN_NAMES = new Set(['testing', 'metadata', 'static-assets'])
const SERVER_HOOK_NAMES = new Set([
  'onBeforeBuild',
  'onAfterBuild',
  'onPageSet',
  'onPageUpdate',
  'onPageDelete',
  'onComponentSet',
  'onComponentUpdate',
  'onComponentDelete'
])
const CLIENT_HOOK_NAMES = new Set([
  'onConnected',
  'onDisconnected',
  'onBeforeComponentRender',
  'onAfterComponentRender'
])
const SERVER_ONLY_MODULES = new Set([
  'fs',
  'node:fs',
  'fs/promises',
  'node:fs/promises',
  'path',
  'node:path',
  'express',
  'http',
  'node:http',
  'https',
  'node:https',
  'child_process',
  'node:child_process',
  'os',
  'node:os'
])

/**
 * @param {Object} params
 * @param {string} params.code
 * @param {import('../types/index.js').CoraliteDiagnosticSeverity} [params.severity='error']
 * @param {string} params.message
 * @param {string} [params.filePath]
 * @param {number} [params.line]
 * @param {number} [params.column]
 * @param {string} [params.sourceCode]
 * @param {string} [params.cause]
 * @param {import('../types/index.js').CoraliteDiagnosticFix} [params.fix]
 * @returns {CoraliteDiagnostic}
 */
function createDiagnostic ({ code, severity = 'error', message, filePath, line, column, sourceCode, cause, fix }) {
  /** @type {CoraliteDiagnostic} */
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
 * Recursively extracts pattern bindings (identifiers) into a target set.
 *
 * @param {Object} pattern - AST pattern node
 * @param {Set<string>} bindingSet - Target set to collect identifier names
 */
function extractPatternBindings (pattern, bindingSet) {
  if (!pattern) {
    return
  }
  if (pattern.type === 'Identifier') {
    bindingSet.add(pattern.name)
  } else if (pattern.type === 'ObjectPattern') {
    for (const prop of pattern.properties || []) {
      if (prop.type === 'Property') {
        extractPatternBindings(prop.value, bindingSet)
      } else if (prop.type === 'RestElement') {
        extractPatternBindings(prop.argument, bindingSet)
      }
    }
  } else if (pattern.type === 'ArrayPattern') {
    for (const el of pattern.elements || []) {
      if (el) {
        extractPatternBindings(el, bindingSet)
      }
    }
  } else if (pattern.type === 'AssignmentPattern') {
    extractPatternBindings(pattern.left, bindingSet)
  } else if (pattern.type === 'RestElement') {
    extractPatternBindings(pattern.argument, bindingSet)
  }
}

/**
 * Extracts top-level module scope bindings and enclosing factory function bindings from a module AST.
 *
 * @param {Object} ast - Module AST node
 * @returns {Set<string>} Set of bound identifier names at module/factory scope
 */
export function extractModuleScopeBindings (ast) {
  const bindings = new Set()

  if (!ast || typeof ast !== 'object') {
    return bindings
  }

  const processDeclarationNode = (node) => {
    if (!node) {
      return
    }

    if (node.type === 'ImportDeclaration') {
      for (const spec of node.specifiers || []) {
        if (spec.local && spec.local.name) {
          bindings.add(spec.local.name)
        }
      }
    } else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations || []) {
        extractPatternBindings(decl.id, bindings)
      }
    } else if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      if (node.id && node.id.name) {
        bindings.add(node.id.name)
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        processDeclarationNode(node.declaration)
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration) {
        if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
          if (node.declaration.id && node.declaration.id.name) {
            bindings.add(node.declaration.id.name)
          }
        } else if (node.declaration.type === 'VariableDeclaration') {
          processDeclarationNode(node.declaration)
        }
      }
    }
  }

  if (ast.type === 'Program' && Array.isArray(ast.body)) {
    for (const stmt of ast.body) {
      processDeclarationNode(stmt)
    }
  }

  walkAncestorJS(ast, {
    CallExpression (node, ancestors) {
      if (node.callee && node.callee.type === 'Identifier' && node.callee.name === 'definePlugin') {
        for (let i = ancestors.length - 2; i >= 0; i--) {
          const ancestor = ancestors[i]
          if (
            ancestor.type === 'FunctionDeclaration' ||
            ancestor.type === 'FunctionExpression' ||
            ancestor.type === 'ArrowFunctionExpression'
          ) {
            for (const param of ancestor.params || []) {
              extractPatternBindings(param, bindings)
            }
            if (ancestor.body) {
              walkJS(ancestor.body, {
                VariableDeclarator (vNode) {
                  extractPatternBindings(vNode.id, bindings)
                },
                FunctionDeclaration (fNode) {
                  if (fNode.id && fNode.id.name) {
                    bindings.add(fNode.id.name)
                  }
                },
                ClassDeclaration (cNode) {
                  if (cNode.id && cNode.id.name) {
                    bindings.add(cNode.id.name)
                  }
                }
              })
            }
          }
        }
      }
    }
  })

  return bindings
}

/**
 * Extracts free outer-scope identifier references from a function AST or function reference.
 *
 * @param {Function|string|Object} fnNodeOrCode - Function, function source string, or AST node
 * @param {Object} [options={}] - Options
 * @param {string} [options.sourceCode=''] - Raw source code context for pragma extraction
 * @param {string} [options.pluginName=''] - Plugin name for context
 * @param {Set<string>|Array<string>} [options.moduleBindings] - Module-scope declared bindings
 * @returns {Array<{ name: string, line?: number, column?: number }>} List of outer scope references
 */
export function findOuterScopeReferences (fnNodeOrCode, options = {}) {
  let moduleBindings = null
  if (options.moduleBindings) {
    if (options.moduleBindings instanceof Set) {
      moduleBindings = options.moduleBindings
    } else {
      moduleBindings = new Set(options.moduleBindings)
    }
  }

  if (!moduleBindings || moduleBindings.size === 0) {
    return []
  }

  let sourceStr = options.sourceCode || ''
  let astNode = null

  if (typeof fnNodeOrCode === 'function') {
    sourceStr = fnNodeOrCode.toString()
  } else if (typeof fnNodeOrCode === 'string') {
    sourceStr = fnNodeOrCode
  } else if (fnNodeOrCode && typeof fnNodeOrCode === 'object' && fnNodeOrCode.type) {
    astNode = fnNodeOrCode
  }

  if (sourceStr && /@coralite-ignore-serialization|coralite-ignore-serialization/i.test(sourceStr)) {
    return []
  }

  const ignoredSymbols = new Set()
  if (sourceStr) {
    const pragmaRegex = /(?:<!--|\/\*|\/\/)\s*@?coralite-ignore\s+([^\n*]*?)(?:-->|\*\/|\n|$)/gi
    let pMatch
    while ((pMatch = pragmaRegex.exec(sourceStr)) !== null) {
      const symbols = pMatch[1].split(/[\s,]+/).filter(Boolean)
      for (const sym of symbols) {
        if (sym !== 'serialization' && sym !== '@coralite-ignore-serialization') {
          ignoredSymbols.add(sym)
        }
      }
    }
  }

  if (!astNode) {
    if (!sourceStr || sourceStr.trim().length === 0) {
      return []
    }
    try {
      astNode = parseJS(sourceStr, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true
      })
    } catch {
      try {
        astNode = parseJS(`(${sourceStr})`, {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true
        })
      } catch {
        try {
          astNode = parseJS(`({ ${sourceStr} })`, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true
          })
        } catch {
          try {
            astNode = parseJS(`function _wrapper() { return (${sourceStr}); }`, {
              ecmaVersion: 'latest',
              sourceType: 'module',
              locations: true
            })
          } catch {
            return []
          }
        }
      }
    }
  }

  let targetNode = astNode
  if (targetNode.type === 'Program') {
    if (targetNode.body.length === 1) {
      const stmt = targetNode.body[0]
      if (stmt.type === 'ExpressionStatement') {
        targetNode = stmt.expression
      } else if (stmt.type === 'FunctionDeclaration') {
        targetNode = stmt
      }
    }
  }

  if (targetNode.type === 'ObjectExpression' && targetNode.properties && targetNode.properties.length === 1 && targetNode.properties[0].type === 'Property') {
    targetNode = targetNode.properties[0].value
  }

  const localBindings = new Set()

  walkJS(targetNode, {
    FunctionDeclaration (node) {
      if (node.id && node.id.type === 'Identifier') {
        localBindings.add(node.id.name)
      }
      for (const param of node.params || []) {
        extractPatternBindings(param, localBindings)
      }
    },
    FunctionExpression (node) {
      if (node.id && node.id.type === 'Identifier') {
        localBindings.add(node.id.name)
      }
      for (const param of node.params || []) {
        extractPatternBindings(param, localBindings)
      }
    },
    ArrowFunctionExpression (node) {
      for (const param of node.params || []) {
        extractPatternBindings(param, localBindings)
      }
    },
    VariableDeclarator (node) {
      extractPatternBindings(node.id, localBindings)
    },
    ClassDeclaration (node) {
      if (node.id && node.id.type === 'Identifier') {
        localBindings.add(node.id.name)
      }
    },
    CatchClause (node) {
      if (node.param) {
        extractPatternBindings(node.param, localBindings)
      }
    }
  })

  if (targetNode.type === 'FunctionDeclaration' || targetNode.type === 'FunctionExpression' || targetNode.type === 'ArrowFunctionExpression') {
    for (const param of targetNode.params || []) {
      extractPatternBindings(param, localBindings)
    }
  }

  /** @type {Map<string, { name: string, line?: number, column?: number }>} */
  const outerRefsMap = new Map()

  walkAncestorJS(targetNode, {
    Identifier (n, a) {
      /** @type {any} */
      const node = n
      /** @type {any[]} */
      const ancestors = a
      const name = node.name

      if (localBindings.has(name) || ignoredSymbols.has(name) || !moduleBindings.has(name)) {
        return
      }

      const parent = ancestors.length > 1 ? ancestors[ancestors.length - 2] : null
      if (!parent) {
        return
      }

      if (parent.type === 'MetaProperty') {
        return
      }
      if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
        return
      }
      if (parent.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) {
        return
      }
      if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) {
        return
      }
      if (parent.type === 'PropertyDefinition' && parent.key === node && !parent.computed) {
        return
      }
      if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement' || parent.type === 'LabeledStatement') && parent.label === node) {
        return
      }
      if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' || parent.type === 'ImportNamespaceSpecifier') {
        return
      }

      if (!outerRefsMap.has(name)) {
        outerRefsMap.set(name, {
          name,
          line: node.loc ? node.loc.start.line : undefined,
          column: node.loc ? node.loc.start.column + 1 : undefined
        })
      }
    }
  })

  return Array.from(outerRefsMap.values())
}

/**
 * Checks if a value is a plain serializable object (primitives, plain objects, arrays).
 * @param {*} val - Value to test
 * @param {Set<any>} [seen=new Set()] - Set of seen objects for circular reference detection
 * @returns {boolean} True if serializable
 */
function isSerializable (val, seen = new Set()) {
  if (val === null || val === undefined) {
    return true
  }
  const type = typeof val
  if (type === 'boolean' || type === 'number' || type === 'string') {
    return true
  }
  if (type === 'function' || type === 'symbol') {
    return false
  }

  if (type === 'object') {
    if (seen.has(val)) {
      return false
    }
    seen.add(val)

    if (Array.isArray(val)) {
      return val.every(item => isSerializable(item, seen))
    }

    if (val.constructor && val.constructor.name !== 'Object') {
      return false
    }

    for (const key of Object.keys(val)) {
      if (!isSerializable(val[key], seen)) {
        return false
      }
    }
    return true
  }

  return false
}

/**
 * Helper to test if a context function node is Two-Phase curried (returns a inner function).
 *
 * @param {Object} fnNode - AST node of context function
 * @returns {boolean} True if function returns another function
 */
function isTwoPhaseCurried (fnNode) {
  if (!fnNode || (fnNode.type !== 'FunctionExpression' && fnNode.type !== 'ArrowFunctionExpression')) {
    return false
  }

  // Expression body: context: (ctx) => (inst) => { ... }
  if (fnNode.body.type === 'FunctionExpression' || fnNode.body.type === 'ArrowFunctionExpression') {
    return true
  }

  // Block body: context: (ctx) => { return (inst) => { ... } }
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
 * Validates raw plugin source code statically via Acorn AST parsing.
 *
 * @param {string} sourceCode - Raw plugin source code
 * @param {string} [filePath=''] - File path for context
 * @returns {CoralitePluginValidationResult} Validation result
 */
export function validatePluginSource (sourceCode, filePath = '') {
  /** @type {CoralitePluginValidationIssue[]} */
  const issues = []
  /** @type {CoraliteDiagnostic[]} */
  const diagnostics = []

  /**
   * @param {Object} params
   * @param {string} params.code
   * @param {string} [params.legacyCode]
   * @param {import('../types/index.js').CoraliteDiagnosticSeverity} [params.severity='error']
   * @param {string} params.message
   * @param {number} [params.line]
   * @param {number} [params.column]
   * @param {string} [params.cause]
   * @param {import('../types/index.js').CoraliteDiagnosticFix} [params.fix]
   */
  const addIssueAndDiagnostic = ({ code, legacyCode, severity = 'error', message, line, column, cause, fix }) => {
    issues.push({
      type: severity === 'error' ? 'error' : 'warning',
      code: legacyCode || code,
      message,
      line
    })

    diagnostics.push(createDiagnostic({
      code,
      severity,
      message,
      filePath,
      line,
      column,
      sourceCode,
      cause,
      fix
    }))
  }

  let ast
  try {
    ast = parseJS(sourceCode, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })
  } catch (err) {
    const errLine = err.loc ? err.loc.line : 1
    const errCol = err.loc ? err.loc.column + 1 : 1
    addIssueAndDiagnostic({
      code: 'SYNTAX_ERROR',
      legacyCode: 'SYNTAX_ERROR',
      severity: 'error',
      message: `Failed to parse JavaScript AST: ${err.message}`,
      line: errLine,
      column: errCol,
      cause: 'Invalid JavaScript syntax in plugin source file.'
    })

    return {
      filePath,
      pluginName: 'unknown',
      valid: false,
      issues,
      diagnostics,
      metrics: {
        errors: 1,
        warnings: 0
      }
    }
  }

  const moduleBindings = extractModuleScopeBindings(ast)

  let foundDefinePlugin = false
  let pluginName = 'unknown'

  const validatePluginConfigObject = (configObjNode, callLocationNode) => {
    if (!configObjNode || configObjNode.type !== 'ObjectExpression') {
      const line = callLocationNode.loc ? callLocationNode.loc.start.line : undefined
      const column = callLocationNode.loc ? callLocationNode.loc.start.column + 1 : undefined
      addIssueAndDiagnostic({
        code: 'CORALITE-P401',
        legacyCode: 'INVALID_DEFINE_PLUGIN_ARG',
        severity: 'error',
        message: 'definePlugin must be called with an object argument',
        line,
        column,
        cause: 'definePlugin requires a plugin configuration object literal.'
      })
      return
    }

    const properties = configObjNode.properties || []

    /** @type {(p: any) => boolean} */
    const isNameProp = (p) => p.key && (p.key.name === 'name' || p.key.value === 'name')
    const nameProp = properties.find(isNameProp)
    if (!nameProp) {
      const line = callLocationNode.loc ? callLocationNode.loc.start.line : undefined
      const column = callLocationNode.loc ? callLocationNode.loc.start.column + 1 : undefined
      addIssueAndDiagnostic({
        code: 'CORALITE-P101',
        legacyCode: 'MISSING_PLUGIN_NAME',
        severity: 'error',
        message: 'Plugin definition is missing required "name" property',
        line,
        column,
        cause: 'All plugins must specify a unique, non-empty "name" string property.'
      })
    } else if (nameProp.value && nameProp.value.type === 'Literal') {
      pluginName = String(nameProp.value.value)
      const line = nameProp.loc ? nameProp.loc.start.line : undefined
      const column = nameProp.loc ? nameProp.loc.start.column + 1 : undefined
      if (!pluginName || pluginName.trim().length === 0) {
        addIssueAndDiagnostic({
          code: 'CORALITE-P101',
          legacyCode: 'EMPTY_PLUGIN_NAME',
          severity: 'error',
          message: 'Plugin "name" property must be a non-empty string',
          line,
          column,
          cause: 'Plugin "name" property is empty or whitespace-only.'
        })
      } else if (RESERVED_PLUGIN_NAMES.has(pluginName)) {
        addIssueAndDiagnostic({
          code: 'CORALITE-P102',
          legacyCode: 'RESERVED_PLUGIN_NAME',
          severity: 'warning',
          message: `Plugin name "${pluginName}" is a reserved core plugin name`,
          line,
          column,
          cause: `Plugin name "${pluginName}" collides with built-in Coralite core plugin names (${Array.from(RESERVED_PLUGIN_NAMES).join(', ')}).`
        })
      }
    }

    /** @type {(p: any) => boolean} */
    const isServerProp = (p) => p.key && (p.key.name === 'server' || p.key.value === 'server')
    const serverProp = properties.find(isServerProp)
    if (serverProp && serverProp.value && serverProp.value.type === 'ObjectExpression') {
      const serverProps = serverProp.value.properties || []

      for (const sItem of serverProps) {
        /** @type {any} */
        const sp = sItem
        const keyName = sp.key ? (sp.key.name || sp.key.value) : null
        const line = sp.loc ? sp.loc.start.line : undefined
        const column = sp.loc ? sp.loc.start.column + 1 : undefined

        if (keyName && SERVER_HOOK_NAMES.has(keyName)) {
          if (sp.value && sp.value.type !== 'FunctionExpression' && sp.value.type !== 'ArrowFunctionExpression') {
            addIssueAndDiagnostic({
              code: 'CORALITE-P202',
              legacyCode: 'INVALID_HOOK_TYPE',
              severity: 'error',
              message: `Server hook "server.${keyName}" must be a function`,
              line,
              column,
              cause: `Server lifecycle hook "server.${keyName}" must be a function.`
            })
          }
        }

        if (keyName === 'context') {
          if (sp.value && sp.value.type !== 'FunctionExpression' && sp.value.type !== 'ArrowFunctionExpression') {
            addIssueAndDiagnostic({
              code: 'CORALITE-P201',
              legacyCode: 'INVALID_CONTEXT_TYPE',
              severity: 'error',
              message: '"server.context" must be a function',
              line,
              column,
              cause: '"server.context" must be a Two-Phase curried function (pluginContext) => (instanceContext) => { ... }.',
              fix: {
                action: 'wrap_two_phase_context',
                description: 'Wrap context into Two-Phase curried function'
              }
            })
          } else if (sp.value && !isTwoPhaseCurried(sp.value)) {
            addIssueAndDiagnostic({
              code: 'CORALITE-P201',
              legacyCode: 'INVALID_CONTEXT_TYPE',
              severity: 'error',
              message: '"server.context" must be a Two-Phase curried function (pluginContext) => (instanceContext) => { ... }',
              line,
              column,
              cause: '"server.context" returns an object directly instead of a secondary instance context function.',
              fix: {
                action: 'wrap_two_phase_context',
                description: 'Wrap context into Two-Phase curried function'
              }
            })
          }
        }
      }
    }

    /** @type {(p: any) => boolean} */
    const isClientProp = (p) => p.key && (p.key.name === 'client' || p.key.value === 'client')
    const clientProp = properties.find(isClientProp)
    if (clientProp && clientProp.value && clientProp.value.type === 'ObjectExpression') {
      const clientProps = clientProp.value.properties || []

      for (const cItem of clientProps) {
        /** @type {any} */
        const cp = cItem
        const keyName = cp.key ? (cp.key.name || cp.key.value) : null
        const line = cp.loc ? cp.loc.start.line : undefined
        const column = cp.loc ? cp.loc.start.column + 1 : undefined

        if (keyName && CLIENT_HOOK_NAMES.has(keyName)) {
          if (cp.value && cp.value.type !== 'FunctionExpression' && cp.value.type !== 'ArrowFunctionExpression') {
            addIssueAndDiagnostic({
              code: 'CORALITE-P303',
              legacyCode: 'INVALID_HOOK_TYPE',
              severity: 'error',
              message: `Client hook "client.${keyName}" must be a function`,
              line,
              column,
              cause: `Client lifecycle hook "client.${keyName}" must be a function.`
            })
          }
        }

        if (keyName === 'context' || CLIENT_HOOK_NAMES.has(keyName)) {
          if (cp.value && (cp.value.type === 'FunctionExpression' || cp.value.type === 'ArrowFunctionExpression')) {
            const outerRefs = findOuterScopeReferences(cp.value, {
              sourceCode,
              pluginName,
              moduleBindings
            })
            for (const ref of outerRefs) {
              addIssueAndDiagnostic({
                code: 'CORALITE-P301',
                legacyCode: 'SERIALIZATION_BOUNDARY_LEAK',
                severity: 'error',
                message: `[Coralite Serialization Error] Plugin "${pluginName}": client.${keyName} references outer-scope symbol "${ref.name}" which will not be available after serialization. Move this function inside client.${keyName} or pass it via client.config.`,
                line: ref.line || line,
                column: ref.column || column,
                cause: `Outer-scope identifier "${ref.name}" is referenced inside client.${keyName} and cannot be serialized across browser boundaries.`
              })
            }
          }
        }

        if (keyName === 'context') {
          if (cp.value && cp.value.type !== 'FunctionExpression' && cp.value.type !== 'ArrowFunctionExpression') {
            addIssueAndDiagnostic({
              code: 'CORALITE-P201',
              legacyCode: 'INVALID_CONTEXT_TYPE',
              severity: 'error',
              message: '"client.context" must be a function',
              line,
              column,
              cause: '"client.context" must be a Two-Phase curried function (pluginContext) => (instanceContext) => { ... }.',
              fix: {
                action: 'wrap_two_phase_context',
                description: 'Wrap context into Two-Phase curried function'
              }
            })
          } else if (cp.value && !isTwoPhaseCurried(cp.value)) {
            addIssueAndDiagnostic({
              code: 'CORALITE-P201',
              legacyCode: 'INVALID_CONTEXT_TYPE',
              severity: 'error',
              message: '"client.context" must be a Two-Phase curried function (pluginContext) => (instanceContext) => { ... }',
              line,
              column,
              cause: '"client.context" returns an object directly instead of a secondary instance context function.',
              fix: {
                action: 'wrap_two_phase_context',
                description: 'Wrap context into Two-Phase curried function'
              }
            })
          }
        }

        if (keyName === 'config') {
          if (cp.value && (cp.value.type === 'FunctionExpression' || cp.value.type === 'ArrowFunctionExpression')) {
            addIssueAndDiagnostic({
              code: 'CORALITE-P302',
              legacyCode: 'INVALID_CLIENT_CONFIG',
              severity: 'error',
              message: '"client.config" must be a serializable object, received function',
              line,
              column,
              cause: '"client.config" must be a plain serializable object (primitives, plain objects, arrays).'
            })
          }
        }
      }
    }
  }

  walkJS(ast, {
    CallExpression (n) {
      /** @type {any} */
      const node = n
      if (node.callee && node.callee.name === 'definePlugin') {
        foundDefinePlugin = true
        validatePluginConfigObject(node.arguments[0], node)
      }
    }
  })

  if (!foundDefinePlugin) {
    // If definePlugin wasn't called, attempt fallback inspection of default export object
    for (const stmt of ast.body || []) {
      if (stmt.type === 'ExportDefaultDeclaration') {
        const decl = stmt.declaration
        if (decl.type === 'ObjectExpression') {
          validatePluginConfigObject(decl, stmt)
        } else if (decl.type === 'FunctionDeclaration' || decl.type === 'FunctionExpression' || decl.type === 'ArrowFunctionExpression') {
          if (decl.body) {
            walkAncestorJS(decl.body, {
              ReturnStatement (retNode) {
                if (retNode.argument && retNode.argument.type === 'ObjectExpression') {
                  validatePluginConfigObject(retNode.argument, retNode)
                }
              }
            })
          }
        }
      }
    }
  }

  const serverImports = new Set()
  walkJS(ast, {
    ImportDeclaration (n) {
      /** @type {any} */
      const node = n
      const source = node.source ? node.source.value : ''
      if (typeof source === 'string' && SERVER_ONLY_MODULES.has(source)) {
        for (const spec of node.specifiers || []) {
          if (spec.local && spec.local.name) {
            serverImports.add(spec.local.name)
          }
        }
      }
    }
  })

  if (serverImports.size > 0) {
    const flaggedLeaks = new Set()
    walkAncestorJS(ast, {
      Identifier (n, a) {
        /** @type {any} */
        const node = n
        /** @type {any[]} */
        const ancestors = a
        if (serverImports.has(node.name)) {
          const inClient = ancestors.some(ancestor => {
            return ancestor.type === 'Property' && ancestor.key && (ancestor.key.name === 'client' || ancestor.key.value === 'client')
          })

          if (inClient && !flaggedLeaks.has(node.name)) {
            flaggedLeaks.add(node.name)
            const line = node.loc ? node.loc.start.line : undefined
            const column = node.loc ? node.loc.start.column + 1 : undefined
            addIssueAndDiagnostic({
              code: 'CORALITE-P203',
              legacyCode: 'ISOMORPHIC_SCOPE_LEAK',
              severity: 'error',
              message: `Server-only import "${node.name}" referenced inside client plugin block`,
              line,
              column,
              cause: `Server-only module "${node.name}" referenced inside client plugin block will fail in browser environments.`
            })
          }
        }
      }
    })
  }

  if (!foundDefinePlugin) {
    addIssueAndDiagnostic({
      code: 'CORALITE-P401',
      legacyCode: 'NO_DEFINE_PLUGIN_CALL',
      severity: 'warning',
      message: 'No definePlugin() call detected in plugin source file',
      line: 1,
      column: 1,
      cause: 'Plugins should be wrapped in definePlugin({ ... }) for type checking and validation.',
      fix: {
        action: 'wrap_define_plugin',
        description: 'Wrap returned object in definePlugin()'
      }
    })
  }

  const errorsCount = issues.filter(i => i.type === 'error').length
  const warningsCount = issues.filter(i => i.type === 'warning').length

  return {
    filePath,
    pluginName,
    valid: errorsCount === 0,
    issues,
    diagnostics,
    metrics: {
      errors: errorsCount,
      warnings: warningsCount
    }
  }
}

/**
 * Validates an instantiated plugin object dynamically at runtime.
 *
 * @param {Object} plugin - Instantiated Coralite plugin object
 * @param {string} [filePath=''] - File path for context
 * @returns {CoralitePluginValidationResult} Validation result
 */
export function validatePluginObject (plugin, filePath = '') {
  /** @type {CoralitePluginValidationIssue[]} */
  const issues = []
  /** @type {CoraliteDiagnostic[]} */
  const diagnostics = []

  /**
   * @param {Object} params
   * @param {string} params.code
   * @param {string} [params.legacyCode]
   * @param {import('../types/index.js').CoraliteDiagnosticSeverity} [params.severity='error']
   * @param {string} params.message
   * @param {string} [params.cause]
   * @param {import('../types/index.js').CoraliteDiagnosticFix} [params.fix]
   */
  const addIssueAndDiagnostic = ({ code, legacyCode, severity = 'error', message, cause, fix }) => {
    issues.push({
      type: severity === 'error' ? 'error' : 'warning',
      code: legacyCode || code,
      message
    })

    diagnostics.push(createDiagnostic({
      code,
      severity,
      message,
      filePath,
      cause,
      fix
    }))
  }

  if (!plugin || typeof plugin !== 'object') {
    addIssueAndDiagnostic({
      code: 'CORALITE-P101',
      legacyCode: 'INVALID_PLUGIN_OBJECT',
      severity: 'error',
      message: `Plugin export must be an object, received ${typeof plugin}`,
      cause: 'Plugin export is null or not an object.'
    })

    return {
      filePath,
      pluginName: 'unknown',
      valid: false,
      issues,
      diagnostics,
      metrics: {
        errors: 1,
        warnings: 0
      }
    }
  }

  const pluginName = plugin.name || 'unknown'

  if (typeof plugin.name !== 'string' || plugin.name.trim().length === 0) {
    addIssueAndDiagnostic({
      code: 'CORALITE-P101',
      legacyCode: 'MISSING_PLUGIN_NAME',
      severity: 'error',
      message: 'Plugin instance is missing a valid "name" string property',
      cause: 'Plugin instance missing required "name" property.'
    })
  } else if (RESERVED_PLUGIN_NAMES.has(plugin.name)) {
    addIssueAndDiagnostic({
      code: 'CORALITE-P102',
      legacyCode: 'RESERVED_PLUGIN_NAME',
      severity: 'warning',
      message: `Plugin name "${plugin.name}" is a reserved core plugin name`,
      cause: `Plugin name "${plugin.name}" is a reserved core plugin name.`
    })
  }

  if (plugin.server !== undefined && plugin.server !== null) {
    if (typeof plugin.server !== 'object') {
      addIssueAndDiagnostic({
        code: 'CORALITE-P202',
        legacyCode: 'INVALID_SERVER_BLOCK',
        severity: 'error',
        message: `"server" property must be an object, received ${typeof plugin.server}`,
        cause: '"server" property must be an object.'
      })
    } else {
      if (plugin.server.context !== undefined && typeof plugin.server.context !== 'function') {
        addIssueAndDiagnostic({
          code: 'CORALITE-P201',
          legacyCode: 'INVALID_CONTEXT_TYPE',
          severity: 'error',
          message: '"server.context" must be a function',
          cause: '"server.context" must be a function.',
          fix: {
            action: 'wrap_two_phase_context',
            description: 'Wrap context into Two-Phase curried function'
          }
        })
      }

      if (plugin.server.components !== undefined && !Array.isArray(plugin.server.components)) {
        addIssueAndDiagnostic({
          code: 'CORALITE-P202',
          legacyCode: 'INVALID_SERVER_COMPONENTS',
          severity: 'error',
          message: '"server.components" must be an array of component file paths',
          cause: '"server.components" must be an array.'
        })
      }

      for (const hookName of SERVER_HOOK_NAMES) {
        if (plugin.server[hookName] !== undefined && typeof plugin.server[hookName] !== 'function') {
          addIssueAndDiagnostic({
            code: 'CORALITE-P202',
            legacyCode: 'INVALID_HOOK_TYPE',
            severity: 'error',
            message: `Server hook "server.${hookName}" must be a function`,
            cause: `Server hook "server.${hookName}" must be a function.`
          })
        }
      }
    }
  }

  if (plugin.client !== undefined && plugin.client !== null) {
    if (typeof plugin.client !== 'object') {
      addIssueAndDiagnostic({
        code: 'CORALITE-P303',
        legacyCode: 'INVALID_CLIENT_BLOCK',
        severity: 'error',
        message: `"client" property must be an object, received ${typeof plugin.client}`,
        cause: '"client" property must be an object.'
      })
    } else {
      if (plugin.client.context !== undefined && typeof plugin.client.context !== 'function') {
        addIssueAndDiagnostic({
          code: 'CORALITE-P201',
          legacyCode: 'INVALID_CONTEXT_TYPE',
          severity: 'error',
          message: '"client.context" must be a function',
          cause: '"client.context" must be a function.',
          fix: {
            action: 'wrap_two_phase_context',
            description: 'Wrap context into Two-Phase curried function'
          }
        })
      }

      if (plugin.client.config !== undefined) {
        if (!isSerializable(plugin.client.config)) {
          addIssueAndDiagnostic({
            code: 'CORALITE-P302',
            legacyCode: 'NON_SERIALIZABLE_CLIENT_CONFIG',
            severity: 'error',
            message: '"client.config" must be a plain serializable object (no functions or circular references)',
            cause: '"client.config" must be a plain serializable object.'
          })
        }
      }

      if (typeof plugin.client.context === 'function') {
        const outerRefs = findOuterScopeReferences(plugin.client.context, { pluginName })
        for (const ref of outerRefs) {
          addIssueAndDiagnostic({
            code: 'CORALITE-P301',
            legacyCode: 'SERIALIZATION_BOUNDARY_LEAK',
            severity: 'error',
            message: `[Coralite Serialization Error] Plugin "${pluginName}": client.context references outer-scope symbol "${ref.name}" which will not be available after serialization. Move this function inside client.context or pass it via client.config.`,
            cause: `outer-scope symbol "${ref.name}" referenced inside client.context.`
          })
        }
      }

      for (const hookName of CLIENT_HOOK_NAMES) {
        if (plugin.client[hookName] !== undefined) {
          if (typeof plugin.client[hookName] !== 'function') {
            addIssueAndDiagnostic({
              code: 'CORALITE-P303',
              legacyCode: 'INVALID_HOOK_TYPE',
              severity: 'error',
              message: `Client hook "client.${hookName}" must be a function`,
              cause: `Client hook "client.${hookName}" must be a function.`
            })
          } else {
            const outerRefs = findOuterScopeReferences(plugin.client[hookName], { pluginName })
            for (const ref of outerRefs) {
              addIssueAndDiagnostic({
                code: 'CORALITE-P301',
                legacyCode: 'SERIALIZATION_BOUNDARY_LEAK',
                severity: 'error',
                message: `[Coralite Serialization Error] Plugin "${pluginName}": client.${hookName} references outer-scope symbol "${ref.name}" which will not be available after serialization. Move this function inside client.${hookName} or pass it via client.config.`,
                cause: `outer-scope symbol "${ref.name}" referenced inside client.${hookName}.`
              })
            }
          }
        }
      }
    }
  }

  const errorsCount = issues.filter(i => i.type === 'error').length
  const warningsCount = issues.filter(i => i.type === 'warning').length

  return {
    filePath,
    pluginName,
    valid: errorsCount === 0,
    issues,
    diagnostics,
    metrics: {
      errors: errorsCount,
      warnings: warningsCount
    }
  }
}

/**
 * Validates a plugin file on disk by static AST scan and optional dynamic import.
 *
 * @param {string} filePath - Path to plugin file
 * @returns {Promise<CoralitePluginValidationResult>} Validation result
 */
export async function validatePluginFile (filePath) {
  const absPath = resolve(filePath)
  try {
    await access(absPath)
  } catch {
    throw new Error(`Plugin file not found: ${absPath}`)
  }

  const sourceCode = await readFile(absPath, 'utf-8')
  const staticResult = validatePluginSource(sourceCode, filePath)

  try {
    const fileUrl = pathToFileURL(absPath).href
    const imported = await import(fileUrl)
    let pluginObj = imported.default || Object.values(imported).find(val => val && (typeof val === 'object' || typeof val === 'function'))

    // Support Plugin Factory Functions: export default function myPlugin(options = {}) { return definePlugin(...) }
    if (typeof pluginObj === 'function') {
      try {
        const instantiated = pluginObj({})
        if (instantiated && typeof instantiated === 'object' && instantiated.name) {
          pluginObj = instantiated
        }
      } catch {
        // Factory function call error fallback
      }
    }

    if (pluginObj && typeof pluginObj === 'object') {
      const dynamicResult = validatePluginObject(pluginObj, filePath)
      const issueSet = new Set(staticResult.issues.map(i => i.message))
      for (const issue of dynamicResult.issues) {
        if (!issueSet.has(issue.message)) {
          staticResult.issues.push(issue)
        }
      }
      const diagSet = new Set(staticResult.diagnostics.map(d => d.message))
      for (const diag of dynamicResult.diagnostics) {
        if (!diagSet.has(diag.message)) {
          staticResult.diagnostics.push(diag)
        }
      }

      staticResult.pluginName = pluginObj.name || staticResult.pluginName
      staticResult.metrics.errors = staticResult.issues.filter(i => i.type === 'error').length
      staticResult.metrics.warnings = staticResult.issues.filter(i => i.type === 'warning').length
      staticResult.valid = staticResult.metrics.errors === 0
    }
  } catch (err) {
    staticResult.issues.push({
      type: 'warning',
      code: 'IMPORT_WARNING',
      message: `Plugin file could not be imported dynamically: ${err.message}`
    })
    staticResult.diagnostics.push(createDiagnostic({
      code: 'IMPORT_WARNING',
      severity: 'warning',
      message: `Plugin file could not be imported dynamically: ${err.message}`,
      filePath,
      cause: 'Dynamic ESM import failed during plugin validation.'
    }))
  }

  return staticResult
}

/**
 * Validates a directory of plugins recursively.
 *
 * @param {string} pluginsDir - Directory containing plugin files
 * @returns {Promise<CoralitePluginDirectoryValidationReport>} Aggregate validation report
 */
export async function validatePluginsDir (pluginsDir) {
  const absoluteDir = resolve(pluginsDir)
  /** @type {CoralitePluginValidationResult[]} */
  const results = []

  try {
    await access(absoluteDir)
  } catch {
    throw new Error(`Plugins directory not found: ${absoluteDir}`)
  }

  const scanDir = async (dir) => {
    const entries = await readdir(dir)
    await Promise.all(entries.map(async (entry) => {
      const fullPath = join(dir, entry)
      const st = await stat(fullPath)

      if (st.isDirectory()) {
        await scanDir(fullPath)
      } else if (st.isFile()) {
        const ext = extname(entry)
        if (ext === '.js' || ext === '.mjs') {
          try {
            const res = await validatePluginFile(fullPath)
            results.push(res)
          } catch (err) {
            results.push({
              filePath: fullPath,
              pluginName: entry,
              valid: false,
              issues: [{
                type: 'error',
                code: 'FILE_READ_ERROR',
                message: err.message
              }],
              diagnostics: [createDiagnostic({
                code: 'FILE_READ_ERROR',
                severity: 'error',
                message: err.message,
                filePath: fullPath,
                cause: 'Failed to read plugin file from disk.'
              })],
              metrics: {
                errors: 1,
                warnings: 0
              }
            })
          }
        }
      }
    }))
  }

  await scanDir(absoluteDir)

  results.sort((a, b) => (a.filePath || '').localeCompare(b.filePath || ''))

  let totalErrors = 0
  let totalWarnings = 0
  let validPlugins = 0
  let fixableCount = 0

  for (const res of results) {
    totalErrors += res.metrics.errors
    totalWarnings += res.metrics.warnings
    if (res.valid) {
      validPlugins++
    }
    const fixables = (res.diagnostics || []).filter(d => Boolean(d.fix && d.fix.action)).length
    fixableCount += fixables
  }

  return {
    plugins: results,
    summary: {
      totalPlugins: results.length,
      validPlugins,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      fixableCount
    },
    metrics: {
      totalPlugins: results.length,
      validPlugins,
      totalErrors,
      totalWarnings
    }
  }
}

/**
 * Formats a plugin validation report into terminal console or JSON format.
 *
 * @param {CoralitePluginDirectoryValidationReport} report - Directory report
 * @param {Object} [options={}] - Output options
 * @param {string} [options.format='console'] - Format: 'console' or 'json'
 * @returns {string} Formatted output string
 */
export function formatPluginValidationReport (report, options = {}) {
  const format = options.format || 'console'

  if (format === 'json') {
    return JSON.stringify(report, null, 2) + '\n'
  }

  let out = '\n' + kleur.bold().cyan('🪸 Coralite Plugin Validation Report') + '\n'
  out += kleur.gray('─'.repeat(60)) + '\n\n'

  for (const plugin of report.plugins) {
    const status = plugin.valid
      ? kleur.green().bold('✔ VALID')
      : kleur.red().bold('✖ INVALID')

    out += `${kleur.bold(plugin.filePath)} (${kleur.bold(plugin.pluginName)}) ─ ${status}\n`

    if (plugin.issues.length === 0) {
      out += `  ${kleur.green('✔ Plugin contract, hooks, and isomorphic boundaries are valid.')}\n\n`
    } else {
      for (const issue of plugin.issues) {
        const prefix = issue.type === 'error'
          ? kleur.red('  ✖ [ERROR]')
          : kleur.yellow('  ⚠ [WARN]')
        const loc = issue.line ? kleur.gray(` (line ${issue.line})`) : ''
        out += `${prefix} ${issue.message}${loc}\n`
      }
      out += '\n'
    }
  }

  out += kleur.gray('─'.repeat(60)) + '\n'
  const summaryColor = report.metrics.totalErrors === 0 ? kleur.green().bold : kleur.red().bold

  out += summaryColor(
    `Summary: ${report.metrics.totalPlugins} plugin(s) validated | ` +
    `Valid: ${report.metrics.validPlugins}/${report.metrics.totalPlugins} | ` +
    `Errors: ${report.metrics.totalErrors} | Warnings: ${report.metrics.totalWarnings}`
  ) + '\n\n'

  return out
}
