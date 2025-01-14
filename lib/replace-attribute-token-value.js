/**
 * @import { CoraliteCustomElementAttribute } from './get-custom-elements-from-string.js'
 */

/**
 * @param {CoraliteCustomElementAttribute} attribute
 * @param {Object.<string, string>} values
 */
function replaceAttributeTokenValue (attribute, values) {
  let result = attribute.value

  for (let i = 0; i < attribute.tokens.length; i++) {
    const token = attribute.tokens[i]
    const value = values[token.name] || ''

    result = result.replace(token.content, value)
  }


  return result
}

export default replaceAttributeTokenValue
