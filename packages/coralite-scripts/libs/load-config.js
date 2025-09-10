import { join } from 'path'
import { access } from 'fs/promises'

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
async function loadConfig () {
  const configPath = join(process.cwd(), 'coralite.config.js')

  try {
    await access(configPath)

    const config = await import(configPath)

    if (config.default) {
      return config.default
    }
  } catch (error) {
    console.error('Failed to load configuration file:', configPath)
    console.error(error)
  }

  return null
}

export default loadConfig
