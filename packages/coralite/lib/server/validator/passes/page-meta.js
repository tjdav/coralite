import {
  getPropKeyName,
  createDiagnostic
} from '../helpers.js'

/**
 * Pass: Page meta schema validation.
 * Ensures `meta` is an object literal, rejects `required` because pages have no
 * external input, and applies the component schema restrictions for blocked
 * types and asynchronous validate/transform functions.
 *
 * @param {object} context - ValidationContext instance
 */
export function validatePageMeta (context) {
  const metaProp = context.configProps.get('meta')
  if (!metaProp) {
    return
  }

  const { diagnostics, filePath, scriptStartLine, sourceCode } = context

  if (!metaProp.value || metaProp.value.type !== 'ObjectExpression') {
    const valueType = metaProp.value?.type
    if (
      valueType === 'FunctionExpression' ||
      valueType === 'ArrowFunctionExpression' ||
      valueType === 'FunctionDeclaration'
    ) {
      return
    }
    const targetNode = metaProp.key || metaProp
    diagnostics.push(createDiagnostic({
      code: 'CORALITE-E107',
      severity: 'error',
      message: 'Page "meta" must be an object literal of schema definitions.',
      filePath,
      line: targetNode.loc ? targetNode.loc.start.line + scriptStartLine : 1,
      column: targetNode.loc ? targetNode.loc.start.column + 1 : 1,
      sourceCode,
      cause: 'Page meta declarations must be statically analyzable object literals.'
    }))
    return
  }

  for (const prop of metaProp.value.properties) {
    if (prop.type !== 'Property') {
      continue
    }

    const metaName = getPropKeyName(prop)
    if (!metaName) {
      continue
    }

    if (prop.value.type !== 'ObjectExpression') {
      continue
    }

    for (const cfgProp of prop.value.properties) {
      if (cfgProp.type !== 'Property') {
        continue
      }
      const cfgKey = getPropKeyName(cfgProp)

      if (cfgKey === 'required' && isTrueLiteral(cfgProp.value)) {
        diagnostics.push(createDiagnostic({
          code: 'CORALITE-E107',
          severity: 'error',
          message: `Page meta "${metaName}" cannot set "required: true". Pages have no external input; declare a default instead.`,
          filePath,
          line: cfgProp.loc.start.line + scriptStartLine,
          column: cfgProp.loc.start.column + 1,
          sourceCode,
          cause: 'Page meta values are build-time defaults and are never supplied by an external source.'
        }))
      }

      if (cfgKey === 'type') {
        let typeName = null
        if (cfgProp.value.type === 'Identifier') {
          typeName = cfgProp.value.name
        } else if (cfgProp.value.type === 'Literal') {
          typeName = String(cfgProp.value.value)
        }
        if (typeName === 'Array' || typeName === 'Object') {
          diagnostics.push(createDiagnostic({
            code: 'CORALITE-E101',
            severity: 'error',
            message: `Page meta "${metaName}" defines blocked type "${typeName}".`,
            filePath,
            line: cfgProp.loc.start.line + scriptStartLine,
            column: cfgProp.loc.start.column + 1,
            sourceCode,
            cause: 'Array and Object types in page meta cause state pollution and serialization boundary leaks.',
            fix: {
              description: `Page meta "${metaName}" cannot be Array or Object. Move initialization to async server().`
            }
          }))
        }
      }

      if (cfgKey === 'validate' || cfgKey === 'transform') {
        const valNode = cfgProp.value
        if (
          valNode &&
          (valNode.type === 'FunctionExpression' || valNode.type === 'ArrowFunctionExpression') &&
          valNode.async
        ) {
          diagnostics.push(createDiagnostic({
            code: 'CORALITE-E103',
            severity: 'error',
            message: `Page meta "${metaName}" specifies an async ${cfgKey} function.`,
            filePath,
            line: cfgProp.loc.start.line + scriptStartLine,
            column: cfgProp.loc.start.column + 1,
            sourceCode,
            cause: 'Page meta transform and validate functions must be strictly synchronous.',
            fix: {
              description: 'Make meta validate/transform function synchronous'
            }
          }))
        }
      }
    }
  }
}

/**
 * Determines whether a node represents the literal `true`.
 *
 * @param {Object} node - Acorn expression node.
 * @returns {boolean} True when the node is the literal boolean true.
 */
function isTrueLiteral (node) {
  if (!node) {
    return false
  }
  if (node.type === 'Literal') {
    return node.value === true || node.value === 'true'
  }
  if (node.type === 'Identifier') {
    return node.name === 'true'
  }
  return false
}
