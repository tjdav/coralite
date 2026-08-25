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
 * @param {string|{ cwd?: string, silent?: boolean }} [cwd=process.cwd()] - The current working directory or options object.
 * @param {object} [options={}] - Additional options.
 * @param {boolean} [options.silent=false] - Whether to suppress error logs when config is missing or fails.
 */
async function loadConfig (cwd = process.cwd(), { silent = false } = {}) {
  let targetCwd = typeof cwd === 'string' ? cwd : process.cwd()
  let isSilent = silent

  if (cwd && typeof cwd === 'object') {
    if (typeof cwd.cwd === 'string') {
      targetCwd = cwd.cwd
    }
    if (typeof cwd.silent === 'boolean') {
      isSilent = cwd.silent
    }
  }

  const configPath = pathToFileURL(join(targetCwd, 'coralite.config.js'))

  try {
    await access(configPath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (!isSilent) {
        displayError('Configuration file not found', `Could not find coralite.config.js at ${configPath}`)
      }
      return null
    }
    if (!isSilent) {
      displayError('Failed to access configuration file', error)
    }
    return null
  }

  try {
    const config = await import(`${configPath.toString()}?t=${Date.now()}`)

    if (!config.default) {
      if (!isSilent) {
        displayError('Config file must export a default object')
      }
      return null
    }

    return defineConfig(config.default)
  } catch (error) {
    if (!isSilent) {
      displayError('Failed to load configuration file', error.message || error)
    }
    throw error
  }
}

export default loadConfig
