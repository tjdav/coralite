import { join } from 'path'
import { access } from 'fs/promises'
import { pathToFileURL } from 'url'
import { displayError } from './build-utils.js'
import { defineConfig } from './config.js'

/**
 * @import {CoraliteScriptConfig} from '../types/index.js'
 */

/**
 * Loads the configuration for the Coralite project.
 *
 * @returns {Promise<CoraliteScriptConfig|null>} The configuration object containing path settings or null if no config found or invalid
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
  } catch (error) {
    if (error.code === 'ENOENT') {
      displayError('Configuration file not found', `Could not find coralite.config.js at ${configPath}`)
      return null
    }
    displayError('Failed to access configuration file', error)
    return null
  }

  try {
    const config = await import(configPath.toString())

    if (!config.default) {
      displayError('Config file must export a default object')
      return null
    }

    try {
      return defineConfig(config.default)
    } catch (err) {
      displayError('Invalid configuration', err.message)
      return null
    }
  } catch (error) {
    displayError('Failed to load configuration file', error)
    return null
  }
}

export default loadConfig
