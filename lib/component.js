/**
 * @param {Object.<string, Function>} attributes
 */
export function computedAttributes (attributes) {
  const result = {}

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      result[key] = attributes[key].call(this)
    }
  }
  
  return result
}
