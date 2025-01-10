import getTokensFromString from './getTokensFromString.js'

/**
 * @import { CoraliteToken, CoraliteComponent } from './component.js'
 */


/**
 * Extract component from HTML module
 * @param {string} html
 * @param {Object.<string, CoraliteComponent>} [templates={}]
 * @returns {Object.<string, CoraliteComponent>}
 */
function getComponentFromString (html, templates = {}) {
  const matches = html.matchAll(/<template\s+[^>]*>|<\/template>/g)
  let index = 0
  let currentId = null
  let startIndex

  for (const match of matches) {
    if (++index > 2) {
      throw new Error('Unexpected number of templates found, only one is permitted')
    }

    if (currentId === null) {
      const tag = match[0]
      const findIdAttribute = tag.match(/id=["'][^"']*["']/)

      if (!findIdAttribute) {
        throw new Error('Template requires an id attribute but found none at index: ' + match.index)
      }

      const idAttribute = findIdAttribute[0]

      currentId = idAttribute.slice(4, idAttribute.length - 1)
      startIndex = match.index + tag.length
    } else {
      const data = match.input.slice(startIndex, match.index)
      const tokens = getTokensFromString(data)

      templates[currentId] = { data }

      if (tokens.length) {
        templates[currentId].tokens = tokens
      }

      // clear current id
      currentId = null
    }
  }

  return templates
}

export default getComponentFromString
