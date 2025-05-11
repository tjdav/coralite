import { join } from 'node:path'
import { getHtmlFile, getHtmlFiles } from './get-html.js'
import { createComponent, createElement, createTextNode, parseHTMLMeta } from './parse.js'
import { existsSync } from 'node:fs'

/**
 * @import {
 *  HTMLData,
 *  CoraliteTokenOptions,
 *  CoraliteModule,
 *  CoraliteDocument,
 *  CoraliteModuleValues,
 *  CoraliteAggregateTemplate,
 *  CoraliteAggregate,
 *  CoraliteAnyNode,
 *  CoraliteContentNode,
 *  CoraliteDocumentRoot} from '#types'
 */

/**
 * @typedef {Object} Aggregation
 * @property {CoraliteAnyNode[]} nodes - An array of CoraliteAnyNode objects representing the aggregated content nodes.
 * @property {HTMLData[]} [documents] - Optional array of HTMLData objects representing the documents associated with this aggregation.
 */

/**
 * Aggregates HTML content from specified paths into a single collection of components.
 *
 * @param {CoraliteAggregate} options - Configuration object defining the aggregation behavior
 * @param {CoraliteModuleValues} values -Default token values used during component rendering
 * @param {Object.<string, CoraliteModule>} components - Available components library
 * @param {CoraliteDocument} document - Current document being processed (used for context)
 *
 * @returns {Promise.<CoraliteAnyNode[]>} Array of processed content nodes from aggregated documents
 * @throws {Error} If pages directory path is undefined or aggregate path doesn't exist
 *
 * @example
 * ```javascript
 * // Aggregating content from pages under 'components' directory into a component with id 'my-component'
 * aggregate({
 *   path: 'button',
 *   recursive: true,
 *   template: 'my-component'
 * }, {
 *   className: 'btn'
 * }, components, document);
 * ```
 */
export async function aggregate (options, values, components, document) {
  if (!document.path.pages) {
    throw new Error('Document page path was undefined')
  }

  const path = join(document.path.pages, options.path)

  if (!existsSync(path)) {
    /** @TODO Refer to documentation */
    throw new Error('Aggregate path does not exist: "' + path + '"')
  }

  let componentId

  // Determine template component ID from configuration
  if (typeof options.template === 'string') {
    componentId = options.template
  } else if (typeof options.template === 'object') {
    componentId = options.template.item
  }

  if (!componentId) {
    /** @TODO Refer to documentation */
    throw new Error('Aggregate template was undefined')
  }

  // Retrieve HTML pages from specified path
  let pages = await getHtmlFiles({
    path,
    recursive: options.recursive,
    exclude: [document.name]
  })

  let result = []
  let startIndex = 0
  let endIndex = pages.length

  // Apply page offset
  if (options.offset) {
    if (options.offset > endIndex) {
      startIndex = endIndex
    } else {
      startIndex = options.offset
    }
  }

  // Apply page limit
  if (options.limit) {
    const limit = options.limit + startIndex

    if (limit < endIndex) {
      endIndex = limit
    }
  }

  for (let i = startIndex; i < endIndex; i++) {
    const page = pages[i]
    const meta = parseHTMLMeta(page.content)
    const pageValues = Object.assign({}, values)
    let prefix = 'meta_'
    let isFilter = !!options.filter
    let ignorePage = false

    // Process metadata and populate token values for rendering
    for (const key in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, key)) {
        const data = meta[key]
        const content = []
        const firstItem = data[0]
        const firstItemName = prefix + firstItem.name

        if (data.length > 1) {
          // Handle multiple metadata items as list
          for (let i = 0; i < data.length; i++) {
            const item = data[i]
            let name = prefix + item.name
            let suffix = ''

            if (isFilter && !ignorePage) {
              ignorePage = options.filter(item)
            }
            suffix = '_' + i

            if (i === 0) {
              pageValues[name] = item.content
            }

            pageValues[name + suffix] = item.content

            content.push(item.content)
          }

          pageValues[firstItemName + '_list'] = content
        } else {
          // Handle single metadata item
          if (isFilter && !ignorePage) {
            ignorePage = options.filter(firstItem)
          }

          pageValues[firstItemName] = firstItem.content
        }
      }
    }

    // Break processing if page is filtered out
    if (isFilter && !ignorePage) {
      break
    }

    // Render component with current values and add to results
    const component = await createComponent({
      id: componentId,
      values: pageValues,
      components,
      document
    })

    if (typeof component === 'object') {
      // concat rendered components
      result = result.concat(component.children)
    }
  }

  // Sort results based on custom sort function, if provided
  if (typeof options.sort === 'function') {
    result.sort(options.sort)
  }

  return result
}
