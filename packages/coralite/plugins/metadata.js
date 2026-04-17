import { definePlugin } from '#lib'

/**
 * @import { ParseHTMLResult } from '../types/index.js'
 * @import { CoraliteCollectionItem } from '../types/collection.js'
 * @import { Coralite } from '../lib/index.js'
 */

/**
 * Extracts metadata tags from the parsed HTML root elements.
 * Supports static <title> and <meta> tags, as well as resolving dynamic custom
 * element slots inside the <head> segment to compute metadata.
 *
 * @param {Object} context
 * @param {ParseHTMLResult} context.elements - The parsed HTML elements including root
 * @param {Object.<string, any>} context.values - The global values object to store the extracted metadata
 * @param {CoraliteCollectionItem} context.data - The file data currently being evaluated
 * @param {Coralite} context.coraliteContext - The Coralite instance context for component creation
 * @returns {Promise<void>}
 */
async function extractMetadata (context) {
  const { elements, values, data, coraliteContext } = context
  values.page_lang = ''

  // loop through all children of the root element to process metadata in <head> tags.
  for (let i = 0; i < elements.root.children.length; i++) {
    const rootNode = elements.root.children[i]

    // traverse html children to find the head element
    if (rootNode.type === 'tag' && rootNode.name === 'html') {
      values.page_lang = rootNode.attribs.lang

      for (let i = 0; i < rootNode.children.length; i++) {
        const node = rootNode.children[i]

        // check if the current node is a <head> tag where metadata is typically found.
        if (node.type === 'tag' && node.name === 'head') {
          // iterate over the children of the head element to locate meta tags or component slots.
          for (let i = 0; i < node.children.length; i++) {
            const element = node.children[i]

            // if the element is a tag named "meta" with both name and content attributes, store its metadata.
            if (element.type === 'tag') {
              if (element.name === 'meta'
                && element.attribs.name
                && element.attribs.content
              ) {
                const metaName = 'meta_' + element.attribs.name

                values[metaName] = element.attribs.content
              } else if (element.slots) {
                // process component slots by creating a component dynamically.
                const componentElement = await coraliteContext.createComponentElement({
                  id: element.name,
                  values,
                  element,
                  component: /** @type {any} */ ({
                    ...elements,
                    path: data.path
                  }),
                  contextId: data.path.pathname + i + element.name,
                  index: i
                })

                // if the created component returns valid children, iterate over them to extract meta information.
                if (componentElement) {
                  for (let i = 0; i < componentElement.children.length; i++) {
                    const element = componentElement.children[i]

                    // for each child element in the component's returned HTML,
                    // check if it is a meta tag and store its metadata with a '$' prefix.
                    if (element.type === 'tag'
                      && element.name === 'meta'
                      && element.attribs.name
                      && element.attribs.content
                    ) {
                      const metaName = 'meta_' + element.attribs.name

                      values[metaName] = element.attribs.content
                    }
                  }
                }
              } else if (element.name === 'title' && element.children.length && element.children[0].type === 'text') {
                // store page title
                values.page_title = element.children[0].data
              }
            }
          }

          // once the <head> tag is processed, return to exit the loop.
          return
        }
      }
    }
  }
}

export const metadataPlugin = definePlugin({
  name: 'metadata',
  async onPageSet ({ elements, values, data }) {
    await extractMetadata({
      elements,
      values,
      data,
      coraliteContext: this
    })
  },
  async onPageUpdate ({ elements, newValue }) {
    await extractMetadata({
      elements,
      values: newValue.result.values,
      data: newValue,
      coraliteContext: this
    })
  }
})
