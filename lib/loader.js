import { join } from 'path'
import { existsSync } from 'fs'

/**
 * Loads configuration from coralite.config.js in the current working directory.
 * @returns {Promise<Object | null>} The config object or null if file not found.
 */
export async function loadConfig () {
  const configPath = join(process.cwd(), 'coralite.config.js')

  if (existsSync(configPath)) {
    try {
      const config = await import(configPath)

      if (config.default) {
        return config.default
      }
    } catch (error) {
      console.error('Failed to load configuration file:', configPath)
      throw error
    }
  }

  return null
}
