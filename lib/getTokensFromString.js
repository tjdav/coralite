/**
 * @import {CoraliteToken} from './component.js'
 */

/**
 * Extract attributes from string
 * @param {string} string
 * @returns {CoraliteToken[]}
 */
function getTokensFromString (string) {
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

export default getTokensFromString