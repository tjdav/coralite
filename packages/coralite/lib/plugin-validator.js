import { parse as parseJS } from 'acorn'
import { simple as walkJS, ancestor as walkAncestorJS } from 'acorn-walk'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import kleur from 'kleur'

/**
 * @import {
 *   CoralitePluginValidationIssue,
 *   CoralitePluginValidationResult,
 *   CoralitePluginDirectoryValidationReport
 * } from '../types/index.js'
 */

export const STANDARD_GLOBALS = new Set([
  // ECMAScript Built-ins
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'BigInt',
  'Function',
  'Math',
  'JSON',
  'Date',
  'RegExp',
  'Promise',
  'Proxy',
  'Reflect',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'URIError',
  'EvalError',
  'AggregateError',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'globalThis',
  'eval',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'undefined',
  'NaN',
  'Infinity',
  'null',
  'arguments',
  'this',
  'console',
  'Atomics',
  'StructuredClone',
  'structuredClone',

  // Web / Browser Globals
  'window',
  'document',
  'customElements',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'IntersectionObserver',
  'ResizeObserver',
  'AbortController',
  'AbortSignal',
  'fetch',
  'location',
  'navigator',
  'localStorage',
  'sessionStorage',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'queueMicrotask',
  'URL',
  'URLSearchParams',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'Blob',
  'File',
  'FileReader',
  'Image',
  'Audio',
  'Option',
  'performance',
  'crypto',
  'WebSocket',
  'Worker',
  'MessageChannel',
  'MessagePort',
  'BroadcastChannel',
  'indexedDB',
  'history',

  // Coralite Globals
  '__coralite__',
  'createCoraliteElement'
])

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
 * Extracts free outer-scope identifier references from a function AST or function reference.
 *
 * @param {Function|string|Object} fnNodeOrCode - Function, function source string, or AST node
 * @param {Object} [options={}] - Options
 * @param {string} [options.sourceCode=''] - Raw source code context for pragma extraction
 * @param {string} [options.pluginName=''] - Plugin name for context
 * @returns {Array<{ name: string, line?: number, column?: number }>} List of outer scope references
 */
export function findOuterScopeReferences (fnNodeOrCode, options = {}) {
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

  const extractPatternBindings = (pattern) => {
    if (!pattern) {
      return
    }
    if (pattern.type === 'Identifier') {
      localBindings.add(pattern.name)
    } else if (pattern.type === 'ObjectPattern') {
      for (const prop of pattern.properties || []) {
        if (prop.type === 'Property') {
          extractPatternBindings(prop.value)
        } else if (prop.type === 'RestElement') {
          extractPatternBindings(prop.argument)
        }
      }
    } else if (pattern.type === 'ArrayPattern') {
      for (const el of pattern.elements || []) {
        if (el) {
          extractPatternBindings(el)
        }
      }
    } else if (pattern.type === 'AssignmentPattern') {
      extractPatternBindings(pattern.left)
    } else if (pattern.type === 'RestElement') {
      extractPatternBindings(pattern.argument)
    }
  }

  walkJS(targetNode, {
    FunctionDeclaration (node) {
      if (node.id && node.id.type === 'Identifier') {
        localBindings.add(node.id.name)
      }
      for (const param of node.params || []) {
        extractPatternBindings(param)
      }
    },
    FunctionExpression (node) {
      if (node.id && node.id.type === 'Identifier') {
        localBindings.add(node.id.name)
      }
      for (const param of node.params || []) {
        extractPatternBindings(param)
      }
    },
    ArrowFunctionExpression (node) {
      for (const param of node.params || []) {
        extractPatternBindings(param)
      }
    },
    VariableDeclarator (node) {
      extractPatternBindings(node.id)
    },
    ClassDeclaration (node) {
      if (node.id && node.id.type === 'Identifier') {
        localBindings.add(node.id.name)
      }
    },
    CatchClause (node) {
      if (node.param) {
        extractPatternBindings(node.param)
      }
    }
  })

  if (targetNode.type === 'FunctionDeclaration' || targetNode.type === 'FunctionExpression' || targetNode.type === 'ArrowFunctionExpression') {
    for (const param of targetNode.params || []) {
      extractPatternBindings(param)
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

      if (STANDARD_GLOBALS.has(name) || localBindings.has(name) || ignoredSymbols.has(name)) {
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
          column: node.loc ? node.loc.start.column : undefined
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
 * Validates raw plugin source code statically via Acorn AST parsing.
 *
 * @param {string} sourceCode - Raw plugin source code
 * @param {string} [filePath=''] - File path for context
 * @returns {CoralitePluginValidationResult} Validation result
 */
export function validatePluginSource (sourceCode, filePath = '') {
  /** @type {CoralitePluginValidationIssue[]} */
  const issues = []

  let ast
  try {
    ast = parseJS(sourceCode, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true
    })
  } catch (err) {
    issues.push({
      type: 'error',
      code: 'SYNTAX_ERROR',
      message: `Failed to parse JavaScript AST: ${err.message}`,
      line: err.loc ? err.loc.line : undefined
    })

    return {
      filePath,
      pluginName: 'unknown',
      valid: false,
      issues,
      metrics: {
        errors: 1,
        warnings: 0
      }
    }
  }

  let foundDefinePlugin = false
  let pluginName = 'unknown'

  walkJS(ast, {
    CallExpression (n) {
      /** @type {any} */
      const node = n
      if (node.callee && node.callee.name === 'definePlugin') {
        foundDefinePlugin = true
        const arg = node.arguments[0]
        if (!arg || arg.type !== 'ObjectExpression') {
          issues.push({
            type: 'error',
            code: 'INVALID_DEFINE_PLUGIN_ARG',
            message: 'definePlugin must be called with an object argument',
            line: node.loc ? node.loc.start.line : undefined
          })
          return
        }

        const properties = arg.properties || []

        /** @type {(p: any) => boolean} */
        const isNameProp = (p) => p.key && (p.key.name === 'name' || p.key.value === 'name')
        const nameProp = properties.find(isNameProp)
        if (!nameProp) {
          issues.push({
            type: 'error',
            code: 'MISSING_PLUGIN_NAME',
            message: 'Plugin definition is missing required "name" property',
            line: node.loc ? node.loc.start.line : undefined
          })
        } else if (nameProp.value && nameProp.value.type === 'Literal') {
          pluginName = String(nameProp.value.value)
          if (!pluginName || pluginName.trim().length === 0) {
            issues.push({
              type: 'error',
              code: 'EMPTY_PLUGIN_NAME',
              message: 'Plugin "name" property must be a non-empty string',
              line: nameProp.loc ? nameProp.loc.start.line : undefined
            })
          } else if (RESERVED_PLUGIN_NAMES.has(pluginName)) {
            issues.push({
              type: 'warning',
              code: 'RESERVED_PLUGIN_NAME',
              message: `Plugin name "${pluginName}" is a reserved core plugin name`,
              line: nameProp.loc ? nameProp.loc.start.line : undefined
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
            if (keyName && SERVER_HOOK_NAMES.has(keyName)) {
              if (sp.value && sp.value.type !== 'FunctionExpression' && sp.value.type !== 'ArrowFunctionExpression') {
                issues.push({
                  type: 'error',
                  code: 'INVALID_HOOK_TYPE',
                  message: `Server hook "server.${keyName}" must be a function`,
                  line: sp.loc ? sp.loc.start.line : undefined
                })
              }
            }

            if (keyName === 'context') {
              if (sp.value && sp.value.type !== 'FunctionExpression' && sp.value.type !== 'ArrowFunctionExpression') {
                issues.push({
                  type: 'error',
                  code: 'INVALID_CONTEXT_TYPE',
                  message: '"server.context" must be a function',
                  line: sp.loc ? sp.loc.start.line : undefined
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
            if (keyName && CLIENT_HOOK_NAMES.has(keyName)) {
              if (cp.value && cp.value.type !== 'FunctionExpression' && cp.value.type !== 'ArrowFunctionExpression') {
                issues.push({
                  type: 'error',
                  code: 'INVALID_HOOK_TYPE',
                  message: `Client hook "client.${keyName}" must be a function`,
                  line: cp.loc ? cp.loc.start.line : undefined
                })
              }
            }

            if (keyName === 'context' || CLIENT_HOOK_NAMES.has(keyName)) {
              if (cp.value && (cp.value.type === 'FunctionExpression' || cp.value.type === 'ArrowFunctionExpression')) {
                const outerRefs = findOuterScopeReferences(cp.value, {
                  sourceCode,
                  pluginName
                })
                for (const ref of outerRefs) {
                  issues.push({
                    type: 'error',
                    code: 'SERIALIZATION_BOUNDARY_LEAK',
                    message: `[Coralite Serialization Error] Plugin "${pluginName}": client.${keyName} references outer-scope symbol "${ref.name}" which will not be available after serialization. Move this function inside client.${keyName} or pass it via client.config.`,
                    line: ref.line || (cp.loc ? cp.loc.start.line : undefined)
                  })
                }
              }
            }

            if (keyName === 'context') {
              if (cp.value && cp.value.type !== 'FunctionExpression' && cp.value.type !== 'ArrowFunctionExpression') {
                issues.push({
                  type: 'error',
                  code: 'INVALID_CONTEXT_TYPE',
                  message: '"client.context" must be a function',
                  line: cp.loc ? cp.loc.start.line : undefined
                })
              }
            }

            if (keyName === 'config') {
              if (cp.value && cp.value.type === 'FunctionExpression') {
                issues.push({
                  type: 'error',
                  code: 'INVALID_CLIENT_CONFIG',
                  message: '"client.config" must be a serializable object, received function',
                  line: cp.loc ? cp.loc.start.line : undefined
                })
              }
            }
          }
        }
      }
    }
  })

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
            issues.push({
              type: 'error',
              code: 'ISOMORPHIC_SCOPE_LEAK',
              message: `Server-only import "${node.name}" referenced inside client plugin block`,
              line: node.loc ? node.loc.start.line : undefined
            })
          }
        }
      }
    })
  }

  if (!foundDefinePlugin) {
    issues.push({
      type: 'warning',
      code: 'NO_DEFINE_PLUGIN_CALL',
      message: 'No definePlugin() call detected in plugin source file'
    })
  }

  const errorsCount = issues.filter(i => i.type === 'error').length
  const warningsCount = issues.filter(i => i.type === 'warning').length

  return {
    filePath,
    pluginName,
    valid: errorsCount === 0,
    issues,
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

  if (!plugin || typeof plugin !== 'object') {
    return {
      filePath,
      pluginName: 'unknown',
      valid: false,
      issues: [{
        type: 'error',
        code: 'INVALID_PLUGIN_OBJECT',
        message: `Plugin export must be an object, received ${typeof plugin}`
      }],
      metrics: {
        errors: 1,
        warnings: 0
      }
    }
  }

  const pluginName = plugin.name || 'unknown'

  if (typeof plugin.name !== 'string' || plugin.name.trim().length === 0) {
    issues.push({
      type: 'error',
      code: 'MISSING_PLUGIN_NAME',
      message: 'Plugin instance is missing a valid "name" string property'
    })
  } else if (RESERVED_PLUGIN_NAMES.has(plugin.name)) {
    issues.push({
      type: 'warning',
      code: 'RESERVED_PLUGIN_NAME',
      message: `Plugin name "${plugin.name}" is a reserved core plugin name`
    })
  }

  if (plugin.server !== undefined && plugin.server !== null) {
    if (typeof plugin.server !== 'object') {
      issues.push({
        type: 'error',
        code: 'INVALID_SERVER_BLOCK',
        message: `"server" property must be an object, received ${typeof plugin.server}`
      })
    } else {
      if (plugin.server.context !== undefined && typeof plugin.server.context !== 'function') {
        issues.push({
          type: 'error',
          code: 'INVALID_CONTEXT_TYPE',
          message: '"server.context" must be a function'
        })
      }

      if (plugin.server.components !== undefined && !Array.isArray(plugin.server.components)) {
        issues.push({
          type: 'error',
          code: 'INVALID_SERVER_COMPONENTS',
          message: '"server.components" must be an array of component file paths'
        })
      }

      for (const hookName of SERVER_HOOK_NAMES) {
        if (plugin.server[hookName] !== undefined && typeof plugin.server[hookName] !== 'function') {
          issues.push({
            type: 'error',
            code: 'INVALID_HOOK_TYPE',
            message: `Server hook "server.${hookName}" must be a function`
          })
        }
      }
    }
  }

  if (plugin.client !== undefined && plugin.client !== null) {
    if (typeof plugin.client !== 'object') {
      issues.push({
        type: 'error',
        code: 'INVALID_CLIENT_BLOCK',
        message: `"client" property must be an object, received ${typeof plugin.client}`
      })
    } else {
      if (plugin.client.context !== undefined && typeof plugin.client.context !== 'function') {
        issues.push({
          type: 'error',
          code: 'INVALID_CONTEXT_TYPE',
          message: '"client.context" must be a function'
        })
      }

      if (plugin.client.config !== undefined) {
        if (!isSerializable(plugin.client.config)) {
          issues.push({
            type: 'error',
            code: 'NON_SERIALIZABLE_CLIENT_CONFIG',
            message: '"client.config" must be a plain serializable object (no functions or circular references)'
          })
        }
      }

      if (typeof plugin.client.context === 'function') {
        const outerRefs = findOuterScopeReferences(plugin.client.context, { pluginName })
        for (const ref of outerRefs) {
          issues.push({
            type: 'error',
            code: 'SERIALIZATION_BOUNDARY_LEAK',
            message: `[Coralite Serialization Error] Plugin "${pluginName}": client.context references outer-scope symbol "${ref.name}" which will not be available after serialization. Move this function inside client.context or pass it via client.config.`
          })
        }
      }

      for (const hookName of CLIENT_HOOK_NAMES) {
        if (plugin.client[hookName] !== undefined) {
          if (typeof plugin.client[hookName] !== 'function') {
            issues.push({
              type: 'error',
              code: 'INVALID_HOOK_TYPE',
              message: `Client hook "client.${hookName}" must be a function`
            })
          } else {
            const outerRefs = findOuterScopeReferences(plugin.client[hookName], { pluginName })
            for (const ref of outerRefs) {
              issues.push({
                type: 'error',
                code: 'SERIALIZATION_BOUNDARY_LEAK',
                message: `[Coralite Serialization Error] Plugin "${pluginName}": client.${hookName} references outer-scope symbol "${ref.name}" which will not be available after serialization. Move this function inside client.${hookName} or pass it via client.config.`
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
  if (!existsSync(absPath)) {
    throw new Error(`Plugin file not found: ${absPath}`)
  }

  const sourceCode = readFileSync(absPath, 'utf-8')
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

  if (!existsSync(absoluteDir)) {
    throw new Error(`Plugins directory not found: ${absoluteDir}`)
  }

  const scanDir = async (dir) => {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        await scanDir(fullPath)
      } else if (stat.isFile()) {
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
              metrics: {
                errors: 1,
                warnings: 0
              }
            })
          }
        }
      }
    }
  }

  await scanDir(absoluteDir)

  let totalErrors = 0
  let totalWarnings = 0
  let validPlugins = 0

  for (const res of results) {
    totalErrors += res.metrics.errors
    totalWarnings += res.metrics.warnings
    if (res.valid) {
      validPlugins++
    }
  }

  return {
    plugins: results,
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
