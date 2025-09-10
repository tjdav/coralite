/**
 * @import {CoraliteScriptConfig} from '#types'
 */

/**
 * Defines the Coralite configuration for the project.
 *
 * This function validates and returns the provided configuration object,
 * ensuring it conforms to the expected structure for a Coralite script setup.
 *
 * @param {CoraliteScriptConfig} options - The configuration options for Coralite
 * @returns {CoraliteScriptConfig} The validated configuration object
 *
 * @example
 * ```js
 * import { defineConfig } from 'coralite-scripts'
 *
 * export default defineConfig({
 *   output: './dist',
 *   templates: './src/templates',
 *   pages: './src/pages',
 *   public: './public',
 *   server: {
 *     port: 3000
 *   },
 *   sass: {
 *     input: './src/styles/main.scss'
 *   }
 * })
 * ```
 */
export function defineConfig (options) {
  // Validate required properties for CoraliteConfig
  if (!options || typeof options !== 'object') {
    throw new Error('Configuration must be a valid object')
  }

  if (!options.output || typeof options.output !== 'string') {
    throw new Error('Configuration must contain a valid "output" property')
  }

  if (!options.templates || typeof options.templates !== 'string') {
    throw new Error('Configuration must contain a valid "templates" property')
  }

  if (!options.pages || typeof options.pages !== 'string') {
    throw new Error('Configuration must contain a valid "pages" property')
  }

  // Validate optional server configuration
  if (options.server && typeof options.server !== 'object') {
    throw new Error('Configuration "server" must be an object')
  }

  if (options.server?.port && (typeof options.server.port !== 'number' || options.server.port <= 0)) {
    throw new Error('Configuration "server.port" must be a positive number')
  }

  // Validate sass configuration
  if (options.styles && typeof options.styles !== 'object') {
    throw new Error('Configuration "styles" must be an object')
  }

  if (options.styles?.input && typeof options.styles.input !== 'string') {
    throw new Error('Configuration "styles.input" must be a string')
  }

  if (options.styles?.type) {
    const type = options.styles.type
    if (typeof type !== 'string') {
      throw new Error('Configuration "styles.type" must be a string')
    } else if (type !== 'css' && type !== 'sass' && type !== 'scss') {
      throw new Error('Configuration "styles.type" must be equal to either "css", "sass" or "scss" but found: ' + type)
    }
  }

  // Validate assets path
  if (!options.public || typeof options.public !== 'string') {
    throw new Error('Configuration must contain a valid "public" property')
  }

  return options
}
