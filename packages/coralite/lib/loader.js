import { join } from 'path'
import { access } from 'fs/promises'
import { pathToFileURL } from 'url'

/**
 * @import {CoraliteConfig} from '#types'
 */

/**
 * Loads the configuration for the Coralite project.
 *
 * @returns {Promise<CoraliteConfig>} The configuration object containing path settings or an empty promise if no config found
 *
 * @example
 * ```js
 * import loadConfig from './loadConfig.js'
 *
 * const config = await loadConfig()
 * ```
 */
async function loadConfig () {
  const configPath = pathToFileURL(join(process.cwd(), 'coralite.config.js'))

  try {
    await access(configPath)

    const config = await import(configPath.href)

    if (config.default) {
      return config.default
    }
  } catch (error) {
    return
  }
}

export default loadConfig
