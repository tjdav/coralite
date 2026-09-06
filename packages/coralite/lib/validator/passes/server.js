import { simple as walkJS } from 'acorn-walk'
import {
  RESERVED_CONTEXT_KEYS,
  getPropKeyName,
  createDiagnostic
} from '../helpers.js'
import { analyzeFunctionBlock } from '../function-analyzer.js'

/**
 * Pass 5: Server block validation.
 * Analyzes server function body (CORALITE-E105) and checks returned state keys for reserved name collisions (CORALITE-E104).
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
  if (fnNode && (fnNode.type === 'FunctionExpression' || fnNode.type === 'ArrowFunctionExpression')) {
    analyzeFunctionBlock(fnNode, stateReads, refsCalls, false, false, 0, false, true, context)

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
