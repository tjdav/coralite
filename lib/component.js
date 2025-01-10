/**
 * @callback coraliteComputedTokens
 * @param {Object.<string,string>} tokens
 */

/**
 * @typedef {Object} CoraliteToken
 * @property {string} name - Token name
 * @property {number} startIndex - Start position of token
 * @property {number} endIndex - End position of token
 */

/**
 * @typedef {Object} CoraliteComponent
 * @property {string} data
 * @property {CoraliteToken[]} [tokens]
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

/**
 * @param {CoraliteComponent} component
 * @param {Object} tokens
 * @param {coraliteComputedTokens} [computedTokens=()=>({})]
 */
export function render (component, tokens, computedTokens = () => ({})) {
  const data = component.data
  let values = Object.assign(tokens, computedTokens(tokens))
  let result = ''
  let index = 0

  for (let i = 0; i < component.tokens.length; i++) {
    const token = component.tokens[i]
    const value = values[token.name] || ''

    result += data.slice(index, token.startIndex) + value

    let endIndex = token.endIndex

    if (token.endIndex < token.startIndex + value.length) {
      endIndex = token.startIndex + value.length
    }

    index = endIndex
  }

  if (index < data.length) {
    result += data.slice(index, data.length)
  }
  
  return result
}