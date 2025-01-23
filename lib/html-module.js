import { join } from 'node:path'
import getHTML from './get-html.js'
import { createComponent, parseHTMLMeta } from './parse.js'

/**
 * @import { CoraliteTokenOptions, CoraliteModule, CoraliteDocument } from '#types'
 */

/**
 * Aggregates HTML content from specified paths into a single collection of components.
 *
 * @param {Object} options - Configuration object for the aggregation process
 * @param {string} options.path - The path to aggregate, relative to pages directory
 * @param {string} options.componentId - Unique identifier for the component
 * @param {boolean} [options.recursive] - Whether to recursively search subdirectories
 * @param {CoraliteTokenOptions} [options.tokens] - Token configuration options
 * @param {Object.<string, string>} values - Default token values
 * @param {Object.<string, CoraliteModule>} components - Available components library
 * @param {CoraliteDocument} document - Current document being processed
 *
 * @example
 * ```javascript
 * // Aggregating content from pages under 'components' directory into a component with id 'my-component'
 * aggregate({
 *   path: 'button',
 *   recursive: true,
 *   componentId: 'my-component'
 * }, {
 *   className: 'btn'
 * }, components, document);
 * ```
 */
export async function aggregate (options, values, components, document) {
  const pages = await getHTML({
    path: join(document.path.pages, options.path),
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
      id: options.componentId,
      values: pageValues,
      components,
      document
    })

    result = result.concat(component.children)
  }

  return result
}
