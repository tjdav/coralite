import { definePlugin } from '../lib/plugin.js'
import { parseHTML } from '../lib/utils/server/parse.js'

/**
 * @import { ParseHTMLResult } from '../types/index.js'
 * @import { CoraliteCollectionItem } from '../types/collection.js'
 * @import { CoraliteInstance, CoralitePage } from '../types/core.js'
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
  } else if (element.slots || app.components.getItem(element.name)) {
    const componentElement = await app.createComponentElement({
      id: element.name,
      state,
      element,
      page,
      root: elements.root,
      contextId: data.path.pathname + index + element.name,
      index,
      head: true
    })

    if (componentElement) {
      const parseChildren = (nodes) => {
        if (!Array.isArray(nodes)) {
          return []
        }
        const result = []
        for (const node of nodes) {
          if (node.type === 'text' && typeof node.data === 'string' && node.data.includes('<')) {
            const parsed = parseHTML(node.data)
            if (parsed?.root?.children) {
              result.push(...parsed.root.children)
              continue
            }
          }
          result.push(node)
        }
        return result
      }

      const rawChildren = Array.isArray(componentElement) ? componentElement : (componentElement.children || [])
      const componentChildren = parseChildren(rawChildren)

      for (let j = 0; j < componentChildren.length; j++) {
        const child = componentChildren[j]
        if (child.type === 'tag' && child.name === 'meta' && child.attribs?.name && child.attribs?.content) {
          page.meta[child.attribs.name] = child.attribs.content
        } else if (child.type === 'tag' && child.name === 'title') {
          const extractText = (nodes) => {
            if (!Array.isArray(nodes)) {
              return ''
            }
            return nodes.map(c => {
              if (c.type === 'text') {
                return c.data.replace(/<\/?c-token>/g, '')
              }
              if (c.type === 'tag' && c.name === 'c-token' && c.children) {
                return extractText(c.children)
              }
              if (c.children) {
                return extractText(c.children)
              }
              return ''
            }).join('')
          }
          const titleText = extractText(child.children)

          if (titleText) {
            page.meta.title = titleText
          }
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
 * @param {Object} context - The context used to extract metadata from the document.
 * @param {ParseHTMLResult} context.elements - The parsed HTML elements including root
 * @param {CoralitePage} context.page - The global page object to store the extracted metadata
 * @param {Object.<string, any>} context.state - The global state object to store the extracted metadata
 * @param {CoraliteCollectionItem} context.data - The file data currently being evaluated
 * @param {CoraliteInstance} [context.app] - The global CoraliteInstance
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
