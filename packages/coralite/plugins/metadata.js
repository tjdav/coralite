import { definePlugin } from '../lib/plugin.js'

/**
 * @import { ParseHTMLResult } from '../types/index.js'
 * @import { CoraliteCollectionItem } from '../types/collection.js'
 * @import { Coralite } from '../lib/index.js'
 * @import { CoralitePage } from '../types/core.js'
 */

/**
 * Processes a single element to extract metadata.
 */
async function processMetadataElement (element, context, index) {
  const { page, state, data, app, elements } = context

  if (element.type !== 'tag') {
    return
  }

  if (element.name === 'meta' && element.attribs?.name && element.attribs?.content) {
    page.meta[element.attribs.name] = element.attribs.content
  } else if (element.slots) {
    const componentElement = await app.createComponentElement({
      id: element.name,
      state,
      element,
      page,
      root: elements.root,
      contextId: data.path.pathname + index + element.name,
      index
    })

    if (componentElement) {
      for (let j = 0; j < componentElement.children.length; j++) {
        const child = componentElement.children[j]
        if (child.type === 'tag' && child.name === 'meta' && child.attribs?.name && child.attribs?.content) {
          page.meta[child.attribs.name] = child.attribs.content
        } else if (child.type === 'tag' && child.name === 'title' && child.children?.length && child.children[0].type === 'text') {
          page.meta.title = child.children[0].data
        }
      }
    }
  } else if (element.name === 'title' && element.children?.length && element.children[0].type === 'text') {
    page.meta.title = element.children[0].data
  }
}

/**
 * Extracts metadata tags from the parsed HTML root elements.
 * Supports static <title> and <meta> tags, as well as resolving dynamic custom
 * element slots inside the <head> segment to compute metadata.
 *
 * @param {Object} context -
 * @param {ParseHTMLResult} context.elements - The parsed HTML elements including root
 * @param {CoralitePage} context.page - The global page object to store the extracted metadata
 * @param {Object.<string, any>} context.state - The global state object to store the extracted metadata
 * @param {CoraliteCollectionItem} context.data - The file data currently being evaluated
 * @param {Coralite} [context.app] - The global coralite app instance
 * @returns {Promise<void>}
 */
async function extractMetadata (context) {
  const { elements, page } = context
  page.meta.lang = ''

  for (let i = 0; i < elements.root.children.length; i++) {
    const rootNode = elements.root.children[i]

    if (rootNode.type === 'tag' && rootNode.name === 'html') {
      page.meta.lang = rootNode.attribs?.lang || ''

      for (let j = 0; j < rootNode.children.length; j++) {
        const node = rootNode.children[j]

        if (node.type === 'tag' && node.name === 'head') {
          for (let k = 0; k < node.children.length; k++) {
            await processMetadataElement(node.children[k], context, k)
          }
          return
        }
      }
    }
  }
}

export const metadataPlugin = definePlugin({
  name: 'metadata',
  server: {
    async onPageSet ({ elements, state, page, data, app }) {
      await extractMetadata({
        elements,
        state,
        page,
        data,
        app
      })
    },
    async onPageUpdate ({ elements, page, newValue, app }) {
      await extractMetadata({
        elements,
        state: newValue.result.state,
        page,
        data: newValue,
        app
      })

      return {
        newValue: {
          result: {
            page
          }
        }
      }
    }
  }
})
