/**
 * @import { CoraliteCustomElementAttribute } from './get-custom-elements-from-string.js'
 */

/**
 * @param {CoraliteCustomElementAttribute} attribute
 * @param {Object.<string, string>} values
 */
function replaceAttributeTokenValue (attribute, values) {
  let result = ''
  let index = 0

  for (let i = 0; i < attribute.tokens.length; i++) {
    const token = attribute.tokens[i]
    const value = values[token.name] || ''

    result += result.slice(index, token.startIndex) + value
    index = token.startIndex + value.length

    if (index < token.endIndex) {
      index = token.endIndex
    }
  }

  return result
}

export default replaceAttributeTokenValue
