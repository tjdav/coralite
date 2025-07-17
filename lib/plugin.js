/**
 * @import Coralite from './coralite.js'
 * @import { CoralitePlugin, CoralitePluginInstance } from '#types'
 */

import { basename, dirname } from 'path'
import { getHtmlFile } from './html.js'

/**
 * Creates a new Coralite plugin instance based on provided configuration options.
 *
 * @param {CoralitePlugin & ThisType<Coralite>} options - Plugin configuration object
 *
 * @example
 * const myPlugin = createPlugin({
 *   name: 'my-plugin',
 *   method: (options, context) => {
 *     // Plugin logic implementation
 *   },
 *   templates: ['src/components/header.html', 'src/components/footer.html']
 * })
 */
export function createPlugin ({
  name,
  method,
  templates = [],
  onPageCreate,
  onPageUpdate,
  onPageDelete,
  onTemplateCreate,
  onTemplateUpdate,
  onTemplateDelete
}) {
  // validate that the plugin method is a function
  if (typeof method !== 'function') {
    throw Error('Coralite plugins method expects a function')
  }

  // process template files and store metadata
  const templateResults = []
  for (let i = 0; i < templates.length; i++) {
    const path = templates[i]
    const content = getHtmlFile(path)

    templateResults.push({
      content,
      path: {
        pathname: path,
        dirname: dirname(path),
        filename: basename(path)
      }
    })
  }

  // return the plugin object with all configured properties
  return {
    name,
    method,
    templates: templateResults,
    onPageCreate,
    onPageUpdate,
    onPageDelete,
    onTemplateCreate,
    onTemplateUpdate,
    onTemplateDelete
  }
}
