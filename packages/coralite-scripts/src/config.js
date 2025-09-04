/**
 * @import {CoraliteScriptConfig} from '#types'
 */

/**
 * @param {CoraliteScriptConfig} options
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
  if (options.sass && typeof options.sass !== 'object') {
    throw new Error('Configuration "sass" must be an object')
  }

  if (options.sass?.input && typeof options.sass.input !== 'string') {
    throw new Error('Configuration "sass.input" must be a string')
  }

  // Validate assets path
  if (!options.public || typeof options.public !== 'string') {
    throw new Error('Configuration must contain a valid "public" property')
  }

  return options
}
