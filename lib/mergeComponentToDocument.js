import { render } from './component.js'
import getCustomElementsFromString from './getCustomElementsFromString.js'

/**
 * @import {CoraliteComponent} from './component.js'
 */

/**
 * Merge components into a document
 * @param {string} string
 * @param {Object.<string, CoraliteComponent>} components
 * @returns {string}
 */
function mergeComponentToDocument (string, components) {
  const document = getCustomElementsFromString(string)

  if (!document.customElements.length) {
    // Could not find any custom elements
    return string
  }

  let result = ''
  let index = 0

  for (let i = 0; i < document.customElements.length; i++) {
    const customElement = document.customElements[i]
    const component = components[customElement.id]

    if (component) {
      const renderedComponent = render(component, customElement.attributes, components)

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
