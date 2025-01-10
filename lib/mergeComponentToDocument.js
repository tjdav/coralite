/**
 * @import {CoraliteComponent} from './component.js'
 */

/**
 * Merge components into a document
 * @param {string} document
 * @param {Object.<string, CoraliteComponent>} components
 */
function mergeComponentToDocument (document, components) {
  const customElementMatches = document.matchAll(/<(?<id>[\w]+-[\w]+)\s*(?<attributes>[\s\S]*?)>(?<content>[\s\S]*?)<\/\1>/g)
  
  if (!customElementMatches) {
    // Could not find any custom elements
    return document
  }

  let result = ''

  for (const match of customElementMatches) {
    const customElement = components[match.groups.id]

    if (customElement) {
      const attributes = match.groups.attributes

      if (attributes) {
        const attributeMatches = attributes.matchAll(/(?<name>[a-zA-Z-]+)\s*=\s*["'](?<value>[^"']+)["']/g)

        for (const attributeMatch of attributeMatches) {
          
        }
      }
    }
  }

}

export default mergeComponentToDocument