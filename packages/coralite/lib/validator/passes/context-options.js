import { kebabToCamel } from '../../utils/core.js'
import {
  getPropKeyName,
  createDiagnostic
} from '../helpers.js'

/**
 * Pass 4: Context options validation (provide and consume options).
 * Checks provide structures and consume syntax (CORALITE-E106).
 *
 * @param {object} context - ValidationContext instance
 */
export function validateContextOptions (context) {
  const {
    configProps,
    definedConsumedKeys,
    definedServerProps,
    diagnostics,
    filePath,
    scriptStartLine,
    sourceCode
  } = context

  const provideProp = configProps.get('provide')
  if (provideProp) {
    const isValidProvide = provideProp.value.type === 'ObjectExpression' || (
      provideProp.value.type === 'NewExpression' &&
      provideProp.value.callee.type === 'Identifier' &&
      provideProp.value.callee.name === 'Map'
    )
    if (!isValidProvide) {
      const targetNode = provideProp.key || provideProp
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-E106',
        severity: 'error',
        message: "Component 'provide' option must be an object or new Map().",
        filePath,
        line: targetNode.loc.start.line + scriptStartLine,
        column: targetNode.loc.start.column + 1,
        sourceCode,
        cause: "Component 'provide' defines context providers for descendant components and must be an object or new Map().",
        fix: {
          action: 'convert_to_object',
          description: "Change 'provide' to an object or new Map()"
        }
      }))
    }
  }

  const consumeProp = configProps.get('consume')
  if (consumeProp) {
    if (consumeProp.value.type === 'ArrayExpression') {
      for (const el of consumeProp.value.elements) {
        if (el && el.type === 'Literal' && typeof el.value === 'string') {
          const keyStr = el.value
          const camelKey = kebabToCamel(keyStr)
          definedConsumedKeys.add(keyStr)
          definedConsumedKeys.add(camelKey)
          definedServerProps.add(keyStr)
          definedServerProps.add(camelKey)
        }
      }
    } else if (consumeProp.value.type === 'ObjectExpression') {
      for (const cProp of consumeProp.value.properties) {
        if (cProp.type === 'Property') {
          const cKey = getPropKeyName(cProp)
          if (cKey) {
            const camelKey = kebabToCamel(cKey)
            definedConsumedKeys.add(cKey)
            definedConsumedKeys.add(camelKey)
            definedServerProps.add(cKey)
            definedServerProps.add(camelKey)

            if (cProp.value.type === 'ObjectExpression') {
              let hasDefault = false
              let hasContext = false
              for (const innerP of cProp.value.properties) {
                if (innerP.type === 'Property') {
                  const innerKey = getPropKeyName(innerP)
                  if (innerKey === 'default') {
                    hasDefault = true
                  }
                  if (innerKey === 'context') {
                    hasContext = true
                  }
                }
              }
              if (hasDefault && !hasContext) {
                const targetNode = cProp.key || cProp
                diagnostics.push(createDiagnostic({
                  code: 'CORALITE-E106',
                  severity: 'error',
                  message: `Component 'consume' property '${cKey}' is missing 'context'. Use '{ ${cKey}: { context: contextToken, default: ... } }' or '{ ${cKey}: contextToken }'.`,
                  filePath,
                  line: targetNode.loc.start.line + scriptStartLine,
                  column: targetNode.loc.start.column + 1,
                  sourceCode,
                  cause: `Component 'consume' property '${cKey}' defines a default value but lacks a 'context' identifier.`,
                  fix: {
                    description: `Use '{ ${cKey}: { context: contextToken, default: ... } }' or '{ ${cKey}: contextToken }'`
                  }
                }))
              }
            }
          }
        }
      }
    } else {
      const targetNode = consumeProp.key || consumeProp
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-E106',
        severity: 'error',
        message: "Component 'consume' option must be an array or object.",
        filePath,
        line: targetNode.loc.start.line + scriptStartLine,
        column: targetNode.loc.start.column + 1,
        sourceCode,
        cause: "Component 'consume' declares context keys from ancestor components and must be an array of strings/symbols or an object with defaults.",
        fix: {
          action: 'convert_to_array',
          description: "Change 'consume' to an array of context keys"
        }
      }))
    }
  }
}
