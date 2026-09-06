import { getPropKeyName } from '../helpers.js'
import { analyzeFunctionBlock } from '../function-analyzer.js'

/**
 * Pass 6: Getters validation and inter-getter dependency tracking.
 * Analyzes getter function bodies for state reads, inter-getter state dependencies, and ref calls.
 *
 * @param {object} context - ValidationContext instance
 */
export function validateGetters (context) {
  const { configProps, getterStateDependencies, refsCalls } = context

  const gettersProp = configProps.get('getters')
  if (!gettersProp || gettersProp.value.type !== 'ObjectExpression') {
    return
  }

  for (const getterProp of gettersProp.value.properties) {
    if (getterProp.type !== 'Property') {
      continue
    }
    const gName = getPropKeyName(getterProp)
    if (gName) {
      if (
        getterProp.value.type === 'ArrowFunctionExpression' ||
        getterProp.value.type === 'FunctionExpression'
      ) {
        analyzeFunctionBlock(getterProp.value, getterStateDependencies, refsCalls, true, false, 0, false, false, context)
      }
    }
  }
}
