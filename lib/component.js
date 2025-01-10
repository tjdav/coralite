/**
 * @import {CoraliteComponent} from './getComponentFromString.js'
 * @import {CoraliteToken} from './getTokensFromString.js'
 * @import {coraliteComputedTokens} from './getScriptFromString.js'
 */

/**
 * @param {Object.<string, Function>} tokens
 */
export function computedTokens (tokens) {
  const result = {}

  for (const key in tokens) {
    if (Object.prototype.hasOwnProperty.call(tokens, key)) {
      result[key] = tokens[key].call(this)
    }
  }
  
  return result
}
