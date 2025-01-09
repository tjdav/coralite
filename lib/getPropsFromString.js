/**
 * @typedef {Object} CoraliteProp
 * @property {string} name - Property name
 * @property {number} startIndex - Start position of prop
 * @property {number} endIndex - End position of prop
 */

/**
 * Extract props from string
 * @param {string} string
 * @returns {CoraliteProp[]}
 */
function getPropsFromString (string) {
  const matches = string.matchAll(/\{{[^}]*\}}/g)
  const result = []

  for (const match of matches) {
    const prop = match[0]

    result.push({
      name: prop.slice(2, prop.length -2).trim(),
      startIndex: match.index,
      endIndex: match.index + prop.length
    })
  }

  return result
}

export default getPropsFromString