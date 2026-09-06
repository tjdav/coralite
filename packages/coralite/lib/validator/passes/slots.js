import { getPropKeyName } from '../helpers.js'
import { analyzeFunctionBlock } from '../function-analyzer.js'

/**
 * Pass 7: Slots validation.
 * Records defined slots and analyzes slot function bodies for state reads and ref calls.
 *
 * @param {object} context - ValidationContext instance
 */
export function validateSlots (context) {
  const { configProps, definedSlots, stateReads, refsCalls } = context

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
    if (
      slotProp.value.type === 'FunctionExpression' ||
      slotProp.value.type === 'ArrowFunctionExpression'
    ) {
      analyzeFunctionBlock(slotProp.value, stateReads, refsCalls, false, false, 1, true, false, context)
    }
  }
}
