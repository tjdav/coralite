/**
 * @import Coralite from './coralite.js'
 * @import { CoralitePlugin } from '#types'
 */

import { basename, dirname } from 'path'
import { getHtmlFile } from './html.js'

/**
 * @param {CoralitePlugin & ThisType<Coralite>} options
 */
export function createPlugin ({
  name,
  method,
  templates = []
}) {
  if (typeof method !== 'function') {
    throw Error('Coralite plugins method expects a function')
  }

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

  return {
    name,
    method,
    templates: templateResults
  }
}
