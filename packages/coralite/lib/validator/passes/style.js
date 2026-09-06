import {
  getPropKeyName,
  createDiagnostic
} from '../helpers.js'
import { analyzeFunctionBlock } from '../function-analyzer.js'

/**
 * Pass 8: Style block validation.
 * Checks for async style functions (CORALITE-E303) and analyzes style function bodies for state reads and ref calls.
 *
 * @param {object} context - ValidationContext instance
 */
export function validateStyle (context) {
  const {
    configProps,
    stateReads,
    refsCalls,
    diagnostics,
    filePath,
    scriptStartLine,
    sourceCode
  } = context

  const styleProp = configProps.get('style')
  if (!styleProp || styleProp.value.type !== 'ObjectExpression') {
    return
  }

  for (const prop of styleProp.value.properties) {
    if (prop.type !== 'Property') {
      continue
    }
    const sName = getPropKeyName(prop)
    const fnVal = prop.value

    // CORALITE-E303: Async style getter
    if (
      fnVal &&
      (fnVal.type === 'FunctionExpression' || fnVal.type === 'ArrowFunctionExpression') &&
      fnVal.async
    ) {
      diagnostics.push(createDiagnostic({
        code: 'CORALITE-E303',
        severity: 'error',
        message: `Style getter function '${sName}' is async or returns a Promise.`,
        filePath,
        line: prop.loc.start.line + scriptStartLine,
        column: prop.loc.start.column + 1,
        sourceCode,
        cause: 'Style getter functions must be strictly synchronous.',
        fix: {
          description: 'Make style property function synchronous'
        }
      }))
    }

    if (
      fnVal &&
      (fnVal.type === 'FunctionExpression' || fnVal.type === 'ArrowFunctionExpression')
    ) {
      analyzeFunctionBlock(fnVal, stateReads, refsCalls, true, false, 0, false, false, context)
    }
  }
}
