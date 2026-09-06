import { parse as parseJS } from 'acorn'
import { simple as walkJS } from 'acorn-walk'
import { camelToKebab, kebabToCamel } from '../utils/core.js'
import { buildCodeframe } from '../utils/diagnostics.js'

export const RESERVED_CONTEXT_KEYS = new Set(['state', 'observe', 'signal', 'root', 'refs', 'slots', 'instanceId', 'emit'])
export const RESERVED_IDENTIFIERS = new Set(['undefined', 'null', 'true', 'false', 'NaN'])
export const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/', '%'])
export const COMPARISON_OPERATORS = new Set(['>', '<', '>=', '<=', '==', '===', '!=', '!=='])
export const TOP_LEVEL_CONFIG_KEYS = new Set(['server', 'getters', 'slots', 'style', 'provide', 'consume'])
export const INTERACTIVE_TAGS = new Set(['button', 'input', 'form', 'a', 'select', 'textarea'])

export const NUMBER_WORDS = {
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

/**
 * Calculates 1-based line, column, and 0-based index of a substring in source code.
 *
 * @param {string} source - Full source code string
 * @param {string} substring - Substring to locate
 * @param {number} [searchFrom=0] - Offset index to begin search from
 * @returns {{ line: number, column: number, index: number }} Location object
 */
export function getLocForSubstring (source, substring, searchFrom = 0) {
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

/**
 * Extracts property key name from an object property AST node or method definition node.
 *
 * @param {object} propNode - AST Property or MethodDefinition node
 * @returns {string|null} Key name string, or null if computed/unresolvable
 */
export function getPropKeyName (propNode) {
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

/**
 * Gets the string name of a node property.
 *
 * @param {object} propNode - AST node
 * @param {boolean} [isComputed=false] - Whether the property access is computed
 * @returns {string|null} Property name or null
 */
export function getNodePropName (propNode, isComputed = false) {
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

/**
 * Recursively extracts destructured property keys and local binding names from an ObjectPattern AST node.
 *
 * @param {object} patternNode - ObjectPattern AST node
 * @param {Set<string>} targetSet - Set to receive extracted property keys
 * @param {Set<string>} [localBindingNames] - Optional Set to receive local binding variable names
 */
export function extractDestructuredKeys (patternNode, targetSet, localBindingNames) {
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
 * Derives a valid camelCase getter name from a complex inline template expression.
 *
 * @param {string} expr - Raw inline template expression string
 * @param {Set<string>} existingKeys - Set of existing getter/state/attribute keys for deduplication
 * @returns {string} Unique derived getter name
 */
export function deriveGetterName (expr, existingKeys) {
  let processed = expr
    .replace(/[\r\n\t]+/g, ' ')
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

  /** @type {string[]} */
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

/**
 * Builds defensive JS code string accessing state for an AST node expression.
 *
 * @param {object} node - AST expression node
 * @returns {string} Defensive JS code string
 */
export function buildDefensiveExpr (node) {
  if (!node) {
    return "''"
  }

  switch (node.type) {
    case 'Identifier': {
      const name = node.name
      if (RESERVED_IDENTIFIERS.has(name)) {
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

/**
 * Generates getter implementation code string for a lifted template expression.
 *
 * @param {string} getterName - Name of getter
 * @param {string} expr - Raw expression string
 * @returns {string} Getter function declaration code line
 */
export function generateGetterCode (getterName, expr) {
  let innerCode = ''
  let fallback = "''"

  try {
    const ast = parseJS(`(${expr})`, { ecmaVersion: 'latest' })
    const stmt = ast.body[0]

    if (stmt && stmt.type === 'ExpressionStatement') {
      const exprNode = stmt.expression
      innerCode = buildDefensiveExpr(exprNode)

      if (exprNode.type === 'BinaryExpression') {
        if (ARITHMETIC_OPERATORS.has(exprNode.operator)) {
          fallback = '0'
        } else if (COMPARISON_OPERATORS.has(exprNode.operator)) {
          fallback = null
        }
      } else if (exprNode.type === 'UnaryExpression' && exprNode.operator === '!') {
        fallback = null
      } else if (exprNode.type === 'ConditionalExpression' || exprNode.type === 'TemplateLiteral') {
        fallback = null
      }
    } else {
      innerCode = `state.${expr.replace(/[\r\n\t]+/g, ' ').replace(/[^a-zA-Z0-9_.]/g, '')}`
    }
  } catch {
    const cleanExpr = expr.replace(/[\r\n\t]+/g, ' ').replace(/[^a-zA-Z0-9_.]/g, '')
    innerCode = `state.${cleanExpr}`
  }

  if (fallback !== null) {
    innerCode = `${innerCode} ?? ${fallback}`
  }

  return `${getterName}: ({ state }) => ${innerCode}`
}

/**
 * Parses identifiers from a JS expression string and adds them to targetSet.
 *
 * @param {string} expr - JS expression string
 * @param {Set<string>} targetSet - Target set to collect identifiers
 */
export function extractIdentifiersFromExpr (expr, targetSet) {
  try {
    const ast = parseJS(`(${expr})`, { ecmaVersion: 'latest' })
    walkJS(ast, {
      Identifier (idNode) {
        if (!RESERVED_IDENTIFIERS.has(idNode.name)) {
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

/**
 * Checks if a ref name or its camel/kebab variants is referenced in JS string literals or CSS selectors.
 *
 * @param {string} refName - Element ref name
 * @param {string[]} stringPool - Pool of string literals extracted from script AST
 * @param {string} cleanCss - Sanitized CSS content (comments stripped)
 * @returns {boolean} True if ref is referenced in JS string selector or CSS selector
 */
export function isRefUsedInSelector (refName, stringPool, cleanCss) {
  const variants = [refName, kebabToCamel(refName), camelToKebab(refName)]
  const uniqueVariants = Array.from(new Set(variants))
  const escapedVariants = uniqueVariants.map(v => v.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
  const selectorPattern = new RegExp(`(?<![\\w-])ref\\s*[$*~^]?=\\s*["']?\\b(?:${escapedVariants.join('|')})\\b["']?`, 'i')

  for (const str of stringPool) {
    if (selectorPattern.test(str)) {
      return true
    }
  }

  if (selectorPattern.test(cleanCss)) {
    return true
  }

  return false
}

/**
 * Diagnostic object factory function.
 *
 * @param {object} params - Diagnostic parameters
 * @param {string} params.code - Diagnostic error/warning code (e.g. CORALITE-E101)
 * @param {string} params.severity - Diagnostic severity ('error'|'warning')
 * @param {string} params.message - Diagnostic message
 * @param {string} [params.filePath] - File path
 * @param {number} [params.line] - 1-based line number
 * @param {number} [params.column] - 1-based column number
 * @param {string} [params.sourceCode] - Source code for codeframe preview
 * @param {string} [params.cause] - Diagnostic cause description
 * @param {object} [params.fix] - Fix payload object
 * @returns {object} CoraliteDiagnostic object
 */
export function createDiagnostic ({ code, severity, message, filePath, line, column, sourceCode, cause, fix }) {
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
