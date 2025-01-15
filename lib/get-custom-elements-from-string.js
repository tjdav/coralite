import getTokensFromString from './get-tokens-from-string.js'

/**
 * @import { CoraliteToken, CoraliteCustomElementResult, CoraliteCustomElementAttribute, CoraliteCustomElement } from '#types'
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
