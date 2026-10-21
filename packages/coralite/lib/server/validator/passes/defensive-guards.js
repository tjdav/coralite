import { ancestor as walkAncestorJS } from 'acorn-walk'
import { createDiagnostic } from '../helpers.js'

const BROWSER_GLOBALS = new Set([
  'window',
  'document',
  'customElements',
  'navigator',
  'localStorage',
  'sessionStorage',
  'HTMLElement',
  'Node',
  'Element'
])

/**
 * Extracts destructured context key parameter names from a function node's params.
 *
 * @param {object} fnNode - AST Function node
 * @returns {Set<string>} Set of destructured context key identifier names
 */
function extractDestructuredContextKeys (fnNode) {
  const keys = new Set()
  if (!fnNode || !fnNode.params) {
    return keys
  }

  for (const param of fnNode.params) {
    if (param.type === 'ObjectPattern') {
      for (const prop of param.properties || []) {
        if (prop.type === 'Property') {
          let val = prop.value
          if (val.type === 'AssignmentPattern') {
            val = val.left
          }
          if (val.type === 'Identifier') {
            keys.add(val.name)
          }
        }
      }
    }
  }
  return keys
}

/**
 * Evaluates the truthiness of typeof global check in a given deterministic block.
 *
 * @param {string} globalName - Browser global name
 * @param {string} op - Comparison operator
 * @param {string} blockName - Block name
 * @returns {string} Evaluated boolean string ('true' or 'false')
 */
function evaluateTypeofCheck (globalName, op, blockName) {
  const isDefined = blockName.startsWith('client')
  const isEq = op === '===' || op === '=='

  if (isDefined) {
    return isEq ? 'false' : 'true'
  } else {
    return isEq ? 'true' : 'false'
  }
}

/**
 * Determines whether an identifier is shadowed by an inner function parameter or local declaration.
 *
 * @param {string} identName - Identifier name to test
 * @param {object[]} ancestors - Ancestor AST nodes from walkAncestorJS
 * @param {object} outerFnNode - Root function AST node
 * @returns {boolean} True if shadowed by an inner local scope
 */
function isShadowedInAncestors (identName, ancestors, outerFnNode) {
  const outerIdx = ancestors.indexOf(outerFnNode)
  if (outerIdx === -1) {
    return false
  }

  for (let i = outerIdx + 1; i < ancestors.length - 1; i++) {
    const node = ancestors[i]
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      for (const param of node.params || []) {
        if (param.type === 'Identifier' && param.name === identName) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Recursively inspects an expression node for defensive context key existence guards.
 *
 * @param {object} node - AST Expression node
 * @param {Set<string>} destructuredKeys - Set of destructured context key names
 * @param {object[]} ancestors - AST Ancestor nodes
 * @param {object} outerFnNode - Outer function AST node
 * @returns {string|null} Name of guarded context key, or null
 */
function findGuardedContextKeyInExpr (node, destructuredKeys, ancestors, outerFnNode) {
  if (!node) {
    return null
  }

  if (node.type === 'UnaryExpression' && node.operator === '!') {
    if (node.argument && node.argument.type === 'Identifier') {
      const name = node.argument.name
      if (destructuredKeys.has(name) && !isShadowedInAncestors(name, ancestors, outerFnNode)) {
        return name
      }
    }
  }

  if (node.type === 'BinaryExpression') {
    const { left, right, operator } = node
    if (['==', '===', '!=', '!=='].includes(operator)) {
      let identName = null
      let isNullOrUndef = false

      if (left.type === 'Identifier') {
        identName = left.name
      } else if (right.type === 'Identifier') {
        identName = right.name
      }

      if (
        (left.type === 'Literal' && (left.value === null || left.value === 'undefined')) ||
        (right.type === 'Literal' && (right.value === null || right.value === 'undefined')) ||
        (left.type === 'Identifier' && left.name === 'undefined') ||
        (right.type === 'Identifier' && right.name === 'undefined')
      ) {
        isNullOrUndef = true
      }

      if (identName && isNullOrUndef && destructuredKeys.has(identName) && !isShadowedInAncestors(identName, ancestors, outerFnNode)) {
        return identName
      }
    }
  }

  if (node.type === 'LogicalExpression') {
    return findGuardedContextKeyInExpr(node.left, destructuredKeys, ancestors, outerFnNode) ||
           findGuardedContextKeyInExpr(node.right, destructuredKeys, ancestors, outerFnNode)
  }

  return null
}

/**
 * Inspects a ChainExpression to check if an optional chaining operation is performed directly on a context key.
 *
 * @param {object} chainNode - AST ChainExpression node
 * @param {Set<string>} destructuredKeys - Set of destructured context key names
 * @param {object[]} ancestors - AST Ancestor nodes
 * @param {object} outerFnNode - Outer function AST node
 * @returns {string|null} Name of context key receiving optional chaining, or null
 */
function getDirectOptionalContextKey (chainNode, destructuredKeys, ancestors, outerFnNode) {
  if (!chainNode || !chainNode.expression) {
    return null
  }

  let matchedKey = null

  const checkNode = (node) => {
    if (!node || matchedKey) {
      return
    }

    if (node.optional === true) {
      let target = null
      if (node.type === 'MemberExpression') {
        target = node.object
      } else if (node.type === 'CallExpression') {
        target = node.callee
      }

      if (target && target.type === 'Identifier') {
        const name = target.name
        if (destructuredKeys.has(name) && !isShadowedInAncestors(name, ancestors, outerFnNode)) {
          matchedKey = name
          return
        }
      }
    }

    if (node.type === 'MemberExpression') {
      checkNode(node.object)
    } else if (node.type === 'CallExpression') {
      checkNode(node.callee)
      for (const arg of node.arguments || []) {
        checkNode(arg)
      }
    } else if (node.type === 'ChainExpression') {
      checkNode(node.expression)
    }
  }

  checkNode(chainNode.expression)
  return matchedKey
}

/**
 * Inspects a binary expression for typeof browser global check.
 *
 * @param {object} node - AST BinaryExpression node
 * @returns {object|null} Typeof check details or null
 */
function isTypeofGlobalCheck (node) {
  if (!node || node.type !== 'BinaryExpression') {
    return null
  }

  const { left, right, operator } = node
  if (!['===', '==', '!==', '!='].includes(operator)) {
    return null
  }

  let typeofNode = null
  let literalNode = null

  if (left.type === 'UnaryExpression' && left.operator === 'typeof') {
    typeofNode = left
    literalNode = right
  } else if (right.type === 'UnaryExpression' && right.operator === 'typeof') {
    typeofNode = right
    literalNode = left
  }

  if (!typeofNode || !literalNode) {
    return null
  }

  if (literalNode.type !== 'Literal' || literalNode.value !== 'undefined') {
    return null
  }

  if (!typeofNode.argument || typeofNode.argument.type !== 'Identifier') {
    return null
  }

  const globalName = typeofNode.argument.name
  if (BROWSER_GLOBALS.has(globalName)) {
    return {
      globalName,
      operator,
      typeofNode,
      literalNode
    }
  }

  return null
}

/**
 * Checks a function AST node for defensive guards and improper environment checks.
 *
 * @param {object} fnNode - AST function node
 * @param {string} blockName - Block description (e.g. 'client()', 'server()', 'getters', 'style', 'slots')
 * @param {object} context - ValidationContext or DiagnosticTarget instance
 */
export function checkDefensiveGuardsInFunction (fnNode, blockName, context) {
  if (!fnNode || !fnNode.body) {
    return
  }

  const { diagnostics, filePath, scriptStartLine = 0, sourceCode } = context
  const destructuredKeys = extractDestructuredContextKeys(fnNode)
  const reportedNodes = new Set()

  walkAncestorJS(fnNode.body, {
    IfStatement (ifNode, ancestors) {
      if (reportedNodes.has(ifNode)) {
        return
      }

      const guardedKey = findGuardedContextKeyInExpr(ifNode.test, destructuredKeys, ancestors, fnNode)
      if (guardedKey) {
        reportedNodes.add(ifNode)
        const line = ifNode.loc ? ifNode.loc.start.line + scriptStartLine : 1
        const column = ifNode.loc ? ifNode.loc.start.column + 1 : 1
        diagnostics.push(createDiagnostic({
          code: 'CORALITE-W601',
          severity: 'error',
          message: `Defensive guard on context key "${guardedKey}" in ${blockName}. Context keys are guaranteed by the framework. If "${guardedKey}" is undefined, the plugin is misconfigured or the build is broken — the guard hides that. Remove the guard.`,
          filePath,
          line,
          column,
          sourceCode,
          cause: `Context key "${guardedKey}" is guaranteed to exist by Coralite framework in ${blockName}. Guarding it is redundant and masks integration bugs.`
        }))
        return
      }

      const typeofCheck = isTypeofGlobalCheck(ifNode.test)
      if (typeofCheck) {
        reportedNodes.add(ifNode)
        reportedNodes.add(ifNode.test)
        const { globalName, operator } = typeofCheck
        const line = ifNode.loc ? ifNode.loc.start.line + scriptStartLine : 1
        const column = ifNode.loc ? ifNode.loc.start.column + 1 : 1
        const exprStr = `typeof ${globalName} ${operator} 'undefined'`

        let message = ''
        if (blockName.startsWith('client')) {
          const evalVal = evaluateTypeofCheck(globalName, operator, 'client')
          message = `"${exprStr}" in client() is always ${evalVal}. client() runs in the browser. Remove the check.`
        } else if (blockName.startsWith('server')) {
          const evalVal = evaluateTypeofCheck(globalName, operator, 'server')
          message = `"${exprStr}" in server() is always ${evalVal}. server() runs in Node at build time. Remove the check. Use isServer to branch.`
        } else {
          message = `"${exprStr}" in ${blockName} is redundant. Use isServer to branch explicitly.`
        }

        diagnostics.push(createDiagnostic({
          code: 'CORALITE-W601',
          severity: 'error',
          message,
          filePath,
          line,
          column,
          sourceCode,
          cause: `Environment check "${exprStr}" in ${blockName} is redundant or dead code.`
        }))
      }
    },

    ChainExpression (chainNode, ancestors) {
      if (reportedNodes.has(chainNode)) {
        return
      }

      const rootName = getDirectOptionalContextKey(chainNode, destructuredKeys, ancestors, fnNode)
      if (rootName) {
        reportedNodes.add(chainNode)
        const line = chainNode.loc ? chainNode.loc.start.line + scriptStartLine : 1
        const column = chainNode.loc ? chainNode.loc.start.column + 1 : 1
        diagnostics.push(createDiagnostic({
          code: 'CORALITE-W601',
          severity: 'error',
          message: `Defensive guard on context key "${rootName}" in ${blockName}. Context keys are guaranteed by the framework. If "${rootName}" is undefined, the plugin is misconfigured or the build is broken — the guard hides that. Remove the guard.`,
          filePath,
          line,
          column,
          sourceCode,
          cause: `Optional chaining on context key "${rootName}" in ${blockName} is a defensive guard. Context keys are guaranteed to exist.`
        }))
      }
    },

    BinaryExpression (binNode) {
      if (reportedNodes.has(binNode)) {
        return
      }

      const typeofCheck = isTypeofGlobalCheck(binNode)
      if (typeofCheck) {
        reportedNodes.add(binNode)
        const { globalName, operator } = typeofCheck
        const line = binNode.loc ? binNode.loc.start.line + scriptStartLine : 1
        const column = binNode.loc ? binNode.loc.start.column + 1 : 1
        const exprStr = `typeof ${globalName} ${operator} 'undefined'`

        let message = ''
        if (blockName.startsWith('client')) {
          const evalVal = evaluateTypeofCheck(globalName, operator, 'client')
          message = `"${exprStr}" in client() is always ${evalVal}. client() runs in the browser. Remove the check.`
        } else if (blockName.startsWith('server')) {
          const evalVal = evaluateTypeofCheck(globalName, operator, 'server')
          message = `"${exprStr}" in server() is always ${evalVal}. server() runs in Node at build time. Remove the check. Use isServer to branch.`
        } else {
          message = `"${exprStr}" in ${blockName} is redundant. Use isServer to branch explicitly.`
        }

        diagnostics.push(createDiagnostic({
          code: 'CORALITE-W601',
          severity: 'error',
          message,
          filePath,
          line,
          column,
          sourceCode,
          cause: `Environment check "${exprStr}" in ${blockName} is redundant or dead code.`
        }))
      }
    }
  })
}

/**
 * Pass to validate components, pages, and config blocks for defensive guards (CORALITE-W601).
 *
 * @param {object} context - ValidationContext instance
 */
export function validateDefensiveGuards (context) {
  const { configProps } = context
  if (!configProps) {
    return
  }

  const clientProp = configProps.get('client')
  if (clientProp && clientProp.value && (clientProp.value.type === 'FunctionExpression' || clientProp.value.type === 'ArrowFunctionExpression')) {
    checkDefensiveGuardsInFunction(clientProp.value, 'client()', context)
  }

  const serverProp = configProps.get('server')
  if (serverProp && serverProp.value && (serverProp.value.type === 'FunctionExpression' || serverProp.value.type === 'ArrowFunctionExpression')) {
    checkDefensiveGuardsInFunction(serverProp.value, 'server()', context)
  }

  const gettersProp = configProps.get('getters')
  if (gettersProp && gettersProp.value && gettersProp.value.type === 'ObjectExpression') {
    for (const p of gettersProp.value.properties || []) {
      if (p.type === 'Property' && p.value && (p.value.type === 'FunctionExpression' || p.value.type === 'ArrowFunctionExpression')) {
        checkDefensiveGuardsInFunction(p.value, 'getters', context)
      }
    }
  }

  const styleProp = configProps.get('style')
  if (styleProp && styleProp.value && (styleProp.value.type === 'FunctionExpression' || styleProp.value.type === 'ArrowFunctionExpression')) {
    checkDefensiveGuardsInFunction(styleProp.value, 'style', context)
  }

  const slotsProp = configProps.get('slots')
  if (slotsProp && slotsProp.value && slotsProp.value.type === 'ObjectExpression') {
    for (const p of slotsProp.value.properties || []) {
      if (p.type === 'Property' && p.value && (p.value.type === 'FunctionExpression' || p.value.type === 'ArrowFunctionExpression')) {
        checkDefensiveGuardsInFunction(p.value, 'slots', context)
      }
    }
  }
}
