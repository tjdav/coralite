import { join } from 'node:path'
import getHTML from './get-html.js'
import { createComponent, parseHTMLMeta } from './parse.js'
import { existsSync } from 'node:fs'

/**
 * @import { CoraliteTokenOptions, CoraliteModule, CoraliteDocument, CoraliteModuleValues, CoraliteAggregateTemplate, CoraliteAggregate } from '#types'
 */

/**
 * Aggregates HTML content from specified paths into a single collection of components.
 *
 * @param {CoraliteAggregate} options - Configuration object for the aggregation process
 * @param {CoraliteModuleValues} values - Default token values
 * @param {Object.<string, CoraliteModule>} components - Available components library
 * @param {CoraliteDocument} document - Current document being processed
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

  if (typeof options.template === 'string') {
    componentId = options.template
  } else if (typeof options.template === 'object') {
    componentId = options.template.item
  }

  if (!componentId) {
    /** @TODO Refer to documentation */
    throw new Error('Aggregate template was undefined')
  }

  const pages = await getHTML({
    path,
    recursive: options.recursive,
    exclude: [document.name]
  })

  let result = []
  let startIndex = 0
  let endIndex = pages.length

  if (options.offset) {
    if (options.offset > endIndex) {
      startIndex = endIndex
    } else {
      startIndex = options.offset
    }
  }

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

    for (const key in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, key)) {
        const data = meta[key]
        const content = []
        const firstItem = data[0]
        const firstItemName = prefix + firstItem.name

        if (data.length > 1) {
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
          if (isFilter && !ignorePage) {
            ignorePage = options.filter(firstItem)
          }

          pageValues[firstItemName] = firstItem.content
        }
      }
    }

    // break if page is filtered
    if (isFilter && !ignorePage) {
      break
    }

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

  // sort results
  if (typeof options.sort === 'function') {
    result.sort(options.sort)
  }

  return result
}
