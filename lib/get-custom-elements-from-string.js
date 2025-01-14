import getTokensFromString from './get-tokens-from-string.js'

/**
 * @import { CoraliteToken } from './component.js'
 */

/**
 * @typedef {Object} CoraliteCustomElementResult
 * @property {string} content - Content body
 * @property {CoraliteCustomElement[]} customElements - Custom elements found in content body
 */

/**
 * @typedef {Object} CoraliteCustomElementAttribute
 * @property {string} name - Attribute name
 * @property {string} value - Attribute value
 * @property {CoraliteToken[]} tokens - List of tokens used in attribute value
 */

/**
 * @typedef {Object} CoraliteCustomElement
 * @property {string} id - Custom element ID
 * @property {CoraliteCustomElementAttribute[]} attributes - Custom element attributes
 * @property {string} content
 */

/**
 * Extract web component from string
 * @param {string} string
 */
function getCustomElementsFromString (string) {
  const matches = string.matchAll(/<(?<id>[\w]+-[\w]+)\s*(?<attributes>[\s\S]*?)>(?<content>[\s\S]*?)<\/\1>/g)
  /** @type {CoraliteCustomElement[]} */
  const customElements = []
  let index = 0
  let content = ''

  for (const match of matches) {
    if (!match) {
      return {
        content: string,
        customElements
      }
    }

    const attributesString = match.groups.attributes
    const customElement = {
      id: match.groups.id,
      attributes: [],
      index: match.index
    }

    if (attributesString) {
      const attributeMatches = attributesString.matchAll(/(?<name>[a-zA-Z-]+)\s*=\s*["'](?<value>[^"']+)["']/g)

      for (const attributeMatch of attributeMatches) {
        customElement.attributes.push({
          name: attributeMatch.groups.name,
          value: attributeMatch.groups.value,
          tokens: getTokensFromString(attributeMatch.groups.value)
        })
      }
    }

    content += string.slice(index, match.index)
    index = match.index + match[0].length

    customElements.push(customElement)
  }

  if (index < string.length) {
    // append end of content
    content += string.slice(index, string.length)
  }

  return {
    customElements,
    content
  }
}

export default getCustomElementsFromString
