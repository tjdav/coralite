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

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const meta = parseHTMLMeta(page.content)
    const pageValues = Object.assign({}, values)
    let isFilter = !!options.filter
    let ignorePage = false

    for (const key in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, key)) {
        const data = meta[key]
        const content = []
        const firstItem = data[0]

        if (data.length > 1) {
          for (let i = 0; i < data.length; i++) {
            const item = data[i]
            let suffix = ''

            if (isFilter && !ignorePage) {
              ignorePage = options.filter(item)
            }
            suffix = '_' + i

            if (i === 0) {
              pageValues[item.name] = item.content
            }

            pageValues[item.name + suffix] = item.content

            content.push(item.content)
          }

          pageValues[firstItem.name + '_list'] = content
        } else {
          if (isFilter && !ignorePage) {
            ignorePage = options.filter(firstItem)
          }

          pageValues[firstItem.name] = firstItem.content
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

  return result
}
