import { getPropKeyName, createDiagnostic } from '../helpers.js'
import { analyzeFunctionBlock } from '../function-analyzer.js'

/**
 * Pass 7: Slots validation.
 * Records defined slots and analyzes slot function bodies for state reads and ref calls.
 * Emits CORALITE-E105 for invalid slots function parameter signatures.
 *
 * @param {object} context - ValidationContext instance
 */
export function validateSlots (context) {
  const {
    configProps,
    definedSlots,
    stateReads,
    refsCalls,
    diagnostics,
    filePath,
    scriptStartLine,
    scriptContent,
    sourceCode
  } = context

  const slotsProp = configProps.get('slots')
  if (!slotsProp || slotsProp.value.type !== 'ObjectExpression') {
    return
  }

  for (const slotProp of slotsProp.value.properties) {
    if (slotProp.type !== 'Property') {
      continue
    }
    const slotName = getPropKeyName(slotProp)
    if (slotName) {
      definedSlots.add(slotName)
    }

    const fnNode = slotProp.value
    if (
      fnNode &&
      (fnNode.type === 'FunctionExpression' || fnNode.type === 'ArrowFunctionExpression')
    ) {
      const params = fnNode.params || []
      const isTwoParams = params.length === 2
      const isOneIdentifier = params.length === 1 && params[0].type === 'Identifier'

      if (isTwoParams || isOneIdentifier) {
        let foundText = ''
        if (isTwoParams) {
          let p0Str = params[0].type === 'Identifier' ? params[0].name : 'nodes'
          let p1Fallback = '{ ... }'
          if (params[1].type === 'ObjectPattern') {
            p1Fallback = '{ state }'
          } else if (params[1].type === 'Identifier') {
            p1Fallback = params[1].name
          }
          let p1Str = p1Fallback

          if (scriptContent && params[0].start !== undefined && params[0].end !== undefined) {
            p0Str = scriptContent.slice(params[0].start, params[0].end)
          }
          if (scriptContent && params[1].start !== undefined && params[1].end !== undefined) {
            p1Str = scriptContent.slice(params[1].start, params[1].end)
          }
          foundText = `(${p0Str}, ${p1Str}) => ...`
        } else {
          foundText = `(${params[0].name}) => ...`
        }

        const isFixable = isTwoParams &&
          params[0].type === 'Identifier' &&
          (params[0].name === 'nodes' || params[0].name === 'content') &&
          params[1].type === 'ObjectPattern'

        const locNode = params[0] || fnNode
        diagnostics.push(createDiagnostic({
          code: 'CORALITE-E105',
          severity: 'error',
          message: `CORALITE-E105: slots functions must receive a single destructured context.\nExpected: ({ nodes, state }) => ...\nFound:    ${foundText}`,
          filePath,
          line: locNode.loc ? locNode.loc.start.line + scriptStartLine : 1,
          column: locNode.loc ? locNode.loc.start.column + 1 : 1,
          sourceCode,
          cause: 'Slot functions in Coralite receive a single destructured context object ({ nodes, state, isServer, signal }).',
          fix: isFixable ? {
            action: 'slots_context_migration',
            description: 'Rewrite slots function parameters to destructured context ({ nodes, state })'
          } : null
        }))
      }

      const paramIdx = (params.length > 1) ? 1 : 0
      analyzeFunctionBlock(fnNode, stateReads, refsCalls, false, false, paramIdx, true, false, context)
    }
  }
}
