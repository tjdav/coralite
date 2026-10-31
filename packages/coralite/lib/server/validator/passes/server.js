import { ancestor as walkJSAncestor, simple as walkJS } from 'acorn-walk'
import {
  RESERVED_CONTEXT_KEYS,
  getPropKeyName,
  createDiagnostic
} from '../helpers.js'
import { analyzeFunctionBlock } from '../function-analyzer.js'

const HTTP_CONTEXT_IDENTIFIERS = new Set([
  'headers',
  'cookies',
  'cookie',
  'request',
  'response',
  'req',
  'res'
])

/**
 * Checks if E401 is ignored for a given context or symbol.
 * @param {object} context - ValidationContext instance
 * @returns {boolean}
 */
function isE401Ignored (context) {
  if (!context || !context.ignoredSymbols) {
    return false
  }
  return context.ignoredSymbols.has('E401') || context.ignoredSymbols.has('CORALITE-E401')
}

/**
 * Collects declared variable and parameter names within function scopes.
 *
 * @param {object} node - AST node
 * @param {object[]} ancestors - Array of ancestor AST nodes
 * @returns {Set<string>} Set of declared identifier names in current scope chain
 */
function collectDeclaredNames (node, ancestors) {
  const declared = new Set()

  // Helper to extract names from pattern nodes (Identifier, ObjectPattern, ArrayPattern, AssignmentPattern, RestElement)
  const extractNamesFromPattern = (pat) => {
    if (!pat) {
      return
    }
    if (pat.type === 'Identifier') {
      declared.add(pat.name)
    } else if (pat.type === 'AssignmentPattern') {
      extractNamesFromPattern(pat.left)
    } else if (pat.type === 'RestElement') {
      extractNamesFromPattern(pat.argument)
    } else if (pat.type === 'ObjectPattern') {
      for (const p of pat.properties || []) {
        if (p.type === 'Property') {
          extractNamesFromPattern(p.value)
        } else if (p.type === 'RestElement') {
          extractNamesFromPattern(p.argument)
        }
      }
    } else if (pat.type === 'ArrayPattern') {
      for (const el of pat.elements || []) {
        if (el) {
          extractNamesFromPattern(el)
        }
      }
    }
  }

  for (const anc of ancestors) {
    // Function scope: params
    if (
      anc.type === 'FunctionExpression' ||
      anc.type === 'ArrowFunctionExpression' ||
      anc.type === 'FunctionDeclaration'
    ) {
      for (const param of anc.params || []) {
        extractNamesFromPattern(param)
      }
    }

    // Block/Function scope: variable declarations and function declarations
    let statements = []
    if (anc.type === 'BlockStatement') {
      statements = anc.body
    } else if (anc.type === 'Program') {
      statements = anc.body
    }

    for (const stmt of statements) {
      if (stmt.type === 'VariableDeclaration') {
        for (const decl of stmt.declarations) {
          extractNamesFromPattern(decl.id)
        }
      } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
        declared.add(stmt.id.name)
      }
    }
  }

  return declared
}

/**
 * Checks if an Identifier node is in a reference position (executable position).
 * Excludes: property keys, member expression properties, declaration identifiers, import specifiers, labels.
 *
 * @param {object} node - Identifier AST node
 * @param {object[]} ancestors - Ancestor AST nodes
 * @returns {boolean}
 */
function isReferencePosition (node, ancestors) {
  const parent = ancestors[ancestors.length - 2]
  if (!parent) {
    return false
  }

  // MemberExpression: obj.property — if node is property and !computed, it's a property key, not a reference
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) {
    return false
  }

  // Property: { key: val } — if node is key and !computed, it's a key, not a reference
  if (parent.type === 'Property' && parent.key === node && !parent.computed) {
    return false
  }

  // MethodDefinition: method key
  if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) {
    return false
  }

  // VariableDeclarator id: const id = ...
  if (parent.type === 'VariableDeclarator' && parent.id === node) {
    return false
  }

  // FunctionDeclaration / FunctionExpression / ArrowFunctionExpression params or id
  if (
    (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ArrowFunctionExpression') &&
    (parent.id === node || (parent.params && parent.params.includes(node)))
  ) {
    return false
  }

  // CatchClause param
  if (parent.type === 'CatchClause' && parent.param === node) {
    return false
  }

  // LabeledStatement label
  if (parent.type === 'LabeledStatement' && parent.label === node) {
    return false
  }

  // BreakStatement / ContinueStatement label
  if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && parent.label === node) {
    return false
  }

  return true
}

/**
 * Pass 5: Server block validation.
 * Analyzes server function body (CORALITE-E105) and checks returned state keys for reserved name collisions (CORALITE-E104).
 * Checks references to HTTP request context identifiers in server() (CORALITE-E401).
 *
 * @param {object} context - ValidationContext instance
 */
export function validateServerBlock (context) {
  const {
    configProps,
    stateReads,
    refsCalls,
    diagnostics,
    filePath,
    scriptStartLine,
    sourceCode
  } = context

  const serverProp = configProps.get('server')
  if (!serverProp) {
    return
  }

  const fnNode = serverProp.value
  if (fnNode && (fnNode.type === 'FunctionExpression' || fnNode.type === 'ArrowFunctionExpression' || fnNode.type === 'FunctionDeclaration')) {
    analyzeFunctionBlock(fnNode, stateReads, refsCalls, false, false, 0, false, true, context)

    // CORALITE-E401: HTTP context identifier check
    if (!isE401Ignored(context)) {
      walkJSAncestor(fnNode.body, {
        Identifier (node, ancestors) {
          if (HTTP_CONTEXT_IDENTIFIERS.has(node.name)) {
            if (isReferencePosition(node, ancestors)) {
              const declaredNames = collectDeclaredNames(node, ancestors)
              if (!declaredNames.has(node.name)) {
                diagnostics.push(createDiagnostic({
                  code: 'CORALITE-E401',
                  severity: 'warning',
                  message: `"${node.name}" is not available in server(). Coralite has no HTTP request context — server() runs at build time. Fetch user-specific data in client() instead.`,
                  filePath,
                  line: node.loc ? node.loc.start.line + scriptStartLine : 1,
                  column: node.loc ? node.loc.start.column + 1 : 1,
                  sourceCode,
                  cause: 'HTTP request context identifiers are not available in build-time server() blocks.'
                }))
              }
            }
          }
        }
      })
    }

    walkJS(fnNode.body, {
      ReturnStatement (retNode) {
        if (retNode.argument && retNode.argument.type === 'ObjectExpression') {
          for (const retProp of retNode.argument.properties) {
            if (retProp.type === 'Property') {
              const propName = getPropKeyName(retProp)
              if (propName) {
                // CORALITE-E104: Reserved context collision
                if (RESERVED_CONTEXT_KEYS.has(propName)) {
                  diagnostics.push(createDiagnostic({
                    code: 'CORALITE-E104',
                    severity: 'error',
                    message: `Server property '${propName}' collides with reserved slot context key.`,
                    filePath,
                    line: retProp.loc.start.line + scriptStartLine,
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
}
