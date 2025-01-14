import { render } from './component.js'
import getCustomElementsFromString from './get-custom-elements-from-string.js'
import replaceAttributeTokenValue from './replace-attribute-token-value.js'

/**
 * @import {CoraliteComponent} from './component.js'
 * @import {HTMLData} from './get-html.js'
 */

/**
 * @typedef {Object} CoralitePath
 * @property {string} pages
 * @property {string} components
 */

/**
 * Merge components into a document
 * @param {HTMLData} document
 * @param {Object.<string, CoraliteComponent>} components
 * @param {CoralitePath} path
 * @returns {Promise<string>}
 */
async function mergeComponentToDocument (document, components, path) {
  const customElements = getCustomElementsFromString(document.content)

  if (!customElements.length) {
    // Could not find any custom elements
    return document.content
  }

  let result = document.content

  for (let i = 0; i < customElements.length; i++) {
    const customElement = customElements[i]
    const component = components[customElement.id]

    if (component) {
      /** @type {Object.<string, string>} */
      const values = {}

      for (let i = 0; i < customElement.attributes.length; i++) {
        const attribute = customElement.attributes[i]

        values[attribute.name] = replaceAttributeTokenValue(attribute, values)
      }

      const renderedComponent = await render(component, {
        values,
        path,
        components,
        document
      })

      result = result.replace(customElement.content, renderedComponent)
    }
  }

  return result
}

export default mergeComponentToDocument
