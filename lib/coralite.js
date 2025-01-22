import { join } from 'node:path'
import getHTML from './get-html.js'
import { createComponent, parseHTMLMeta } from './parse.js'

/**
 * @import { CoraliteTokenOptions, CoraliteModule } from '#types'
 */

/**
 * @param {Object} options
 * @param {string} options.path
 * @param {string} options.componentId
 * @param {boolean} [options.recursive]
 * @param {CoraliteTokenOptions} [options.tokens]
 * @param {Object.<string, string>} values
 * @param {Object.<string, CoraliteModule>} components
 * @param {Object} document
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
