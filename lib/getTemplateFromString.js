import getPropsFromString from './getPropsFromString.js'

/** @import { CoraliteProp } from './getPropsFromString.js' */

/**
 * @typedef {Object} CoraliteData
 * @property {string} data
 * @property {CoraliteProp[]} [props]
 */

/**
 * Extract templates from HTML
 * @param {string} html
 * @param {Object.<string, CoraliteData>} [templates={}]
 * @returns {Object.<string, CoraliteData>}
 */
function getTemplateFromString (html, templates = {}) {
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
      const props = getPropsFromString(data)
     
      templates[currentId] = { data }

      if (props.length) {
        templates[currentId].props = props
      }

      // clear current id
      currentId = null
    }
  }

  return templates
}

export default getTemplateFromString