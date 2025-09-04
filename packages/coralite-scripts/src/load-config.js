import { resolve } from 'path'

/**
 * @import {CoraliteScriptConfig} from '#types'
 */

/**
 * Loads the configuration for the Coralite project.
 *
 * @returns {Promise<CoraliteScriptConfig>} The configuration object containing path settings or an empty promise if no config found
 *
 * @example
 * ```js
 * import loadConfig from './loadConfig.js'
 *
 * const config = await loadConfig()
 * ```
 */
export default async function loadConfig () {
  try {
    const config = await import(resolve('coralite.config.js'))

    return config.default
  } catch(error) {
    throw error
  }
}
