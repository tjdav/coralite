import { join } from 'node:path'
import getHTML from './get-html.js'
import { createComponent, parseHTMLMeta } from './parse.js'
import { existsSync } from 'node:fs'

/**
 * @import { CoraliteTokenOptions, CoraliteModule, CoraliteDocument, CoraliteModuleValues, CoraliteAggregateTemplate } from '#types'
 */

/**
 * Aggregates HTML content from specified paths into a single collection of components.
 *
 * @param {Object} options - Configuration object for the aggregation process
 * @param {string} options.path - The path to aggregate, relative to pages directory
 * @param {CoraliteAggregateTemplate | string} options.template - Templates used to display the result
 * @param {boolean} [options.recursive] - Whether to recursively search subdirectories
 * @param {CoraliteTokenOptions} [options.tokens] - Token configuration options
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

    for (const key in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, key)) {
        const data = meta[key]

        for (let i = 0; i < data.length; i++) {
          const item = data[i]
          let suffix = ''

          if (i > 0) {
            suffix = '_' + i
          }

          pageValues[item.name + suffix] = item.content
        }
      }
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
