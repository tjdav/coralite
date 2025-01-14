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
  const matches = string.matchAll(/<(?<id>[\w]+-[\w|\-]+)\s*(?<attributes>[\s\S]*?)>(?<content>[\s\S]*?)<\/\1>/g)
  /** @type {CoraliteCustomElement[]} */
  const customElements = []

  for (const match of matches) {
    if (!match) {
      return customElements
    }

    const attributesString = match.groups.attributes
    const customElement = {
      id: match.groups.id,
      attributes: [],
      content: match[0]
    }

    customElements.push(customElement)

    if (attributesString) {
      const attributeMatches = attributesString.matchAll(/(?<name>[a-zA-Z-]+)\s*=\s*["'](?<value>[^"']+)["']/g)

      for (const attributeMatch of attributeMatches) {
        const attribute = {
          name: attributeMatch.groups.name,
          value: attributeMatch.groups.value,
          tokens: getTokensFromString(attributeMatch.groups.value)
        }

        customElement.attributes.push(attribute)
      }
    }
  }

  return customElements
}

export default getCustomElementsFromString
