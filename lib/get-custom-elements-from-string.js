import getTokensFromString from './get-tokens-from-string.js'

/**
 * @import { CoraliteToken, CoraliteCustomElementResult, CoraliteCustomElementAttribute, CoraliteCustomElement } from '#types'
 */

const customElementRegExp = /<(?<id>[\w]+-[\w|\-]+)\s*(?<attributes>[\s\S]*?)>(?<content>[\s\S]*?)<\/\1>/gi
const attributeRegExp = /(?<name>[a-z0-9-_:]+\b\s*)(?:=(?<value>\s*(?<quotes>'|")[\s\S]*?\3))?/gi
const attributeQuotesExp = /^('|")|('|")$/g
/**
 * Extract web component from string
 * @param {string} string
 */
function getCustomElementsFromString (string) {
  const matches = string.matchAll(customElementRegExp)
  /** @type {CoraliteCustomElement[]} */
  const customElements = []

  for (const match of matches) {
    if (!match) {
      return customElements
    }

    const customElement = {
      id: match.groups.id,
      attributes: [],
      content: match[0]
    }
    customElements.push(customElement)

    const attributesString = match.groups.attributes

    if (attributesString) {
      const attributeMatches = attributesString.matchAll(attributeRegExp)

      for (const attributeMatch of attributeMatches) {
        const value = attributeMatch.groups.value.replace(attributeQuotesExp, '').trim()
        const attribute = {
          name: attributeMatch.groups.name.trim(),
          value,
          tokens: getTokensFromString(value)
        }

        customElement.attributes.push(attribute)
      }
    }
  }

  return customElements
}

export default getCustomElementsFromString
