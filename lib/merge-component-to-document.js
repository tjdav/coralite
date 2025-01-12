import { render } from './component.js'
import getCustomElementsFromString from './get-custom-elements-from-string.js'

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
 * @param {HTMLData} html
 * @param {Object.<string, CoraliteComponent>} components
 * @param {CoralitePath} path
 * @returns {Promise<string>}
 */
async function mergeComponentToDocument (html, components, path) {
  const document = getCustomElementsFromString(html.content)

  if (!document.customElements.length) {
    // Could not find any custom elements
    return html.content
  }

  let result = ''
  let index = 0

  for (let i = 0; i < document.customElements.length; i++) {
    const customElement = document.customElements[i]
    const component = components[customElement.id]

    if (component) {
      const renderedComponent = await render(component, {
        values: customElement.attributes,
        path,
        components,
        document: html
      })

      result += document.content.slice(result.length, customElement.index) + renderedComponent
      index = result.length - renderedComponent.length
    }
  }

  if (index < document.content.length) {
    result += document.content.slice(index, document.content.length)
  }

  return result
}

export default mergeComponentToDocument
