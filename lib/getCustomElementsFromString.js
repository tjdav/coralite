/**
 * @typedef {Object} CoraliteCustomElementResult
 * @property {string} content - Content body
 * @property {CoraliteCustomElement[]} customElements - Custom elements found in content body
 */

/**
 * @typedef {Object} CoraliteCustomElement
 * @property {string} id - Custom element ID
 * @property {Object.<string, string>} attributes - Custom element attributes
 * @property {number} index - Index position of custom element
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
      attributes: {},
      index: match.index
    }

    if (attributesString) {
      const attributeMatches = attributesString.matchAll(/(?<name>[a-zA-Z-]+)\s*=\s*["'](?<value>[^"']+)["']/g)

      for (const attributeMatch of attributeMatches) {
        customElement.attributes[attributeMatch.groups.name] = attributeMatch.groups.value
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
