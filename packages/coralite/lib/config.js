/**
 * @import {CoraliteConfig} from '../types/index.js'
 */
import { CoraliteError } from './utils/errors.js'

/**
 * Validates and defines a Coralite configuration object
 * @param {CoraliteConfig} options - The configuration options to validate and define
 * @returns {CoraliteConfig} The validated configuration object
 * @throws {Error} If the configuration is invalid
 */
export function defineConfig (options) {
  // Validate that options is an object
  if (!options || typeof options !== 'object') {
    throw new CoraliteError('Config must be an object')
  }

  // Validate required string state
  const requiredProps = ['output', 'components', 'pages']

  for (const prop of requiredProps) {
    // Check if property exists
    if (!(prop in options)) {
      throw new CoraliteError(`Missing required config property: "${prop}"`)
    }

    // Check if property is a string
    if (typeof options[prop] !== 'string') {
      throw new CoraliteError(
        `Config property "${prop}" must be a string, received ${typeof options[prop]}`
      )
    }

    // Check if property is not empty
    if (options[prop].trim() === '') {
      throw new CoraliteError(`Config property "${prop}" cannot be empty`)
    }
  }

  // Validate mode
  if (options.mode !== undefined) {
    const validModes = ['production', 'development', 'testing']
    if (!validModes.includes(options.mode)) {
      throw new CoraliteError(`Invalid mode: "${options.mode}". Valid modes are: ${validModes.join(', ')}`)
    }
  }

  // Validate csp config
  if (options.csp !== undefined) {
    if (typeof options.csp !== 'object' || options.csp === null) {
      throw new CoraliteError('Config property "csp" must be an object')
    }

    if (options.csp.enabled !== undefined && typeof options.csp.enabled !== 'boolean') {
      throw new CoraliteError('Config property "csp.enabled" must be a boolean')
    }

    if (options.csp.nonce !== undefined && typeof options.csp.nonce !== 'string' && typeof options.csp.nonce !== 'function') {
      throw new CoraliteError('Config property "csp.nonce" must be a string or function')
    }

    if (options.csp.hashAlgorithm !== undefined) {
      const validAlgorithms = ['sha256', 'sha384', 'sha512']
      if (!validAlgorithms.includes(options.csp.hashAlgorithm)) {
        throw new CoraliteError(`Invalid csp.hashAlgorithm: "${options.csp.hashAlgorithm}". Valid algorithms are: ${validAlgorithms.join(', ')}`)
      }
    }

    if (options.csp.injectMeta !== undefined && typeof options.csp.injectMeta !== 'boolean') {
      throw new CoraliteError('Config property "csp.injectMeta" must be a boolean')
    }

    if (options.csp.reportOnly !== undefined && typeof options.csp.reportOnly !== 'boolean') {
      throw new CoraliteError('Config property "csp.reportOnly" must be a boolean')
    }

    if (options.csp.externalScripts !== undefined && typeof options.csp.externalScripts !== 'boolean') {
      throw new CoraliteError('Config property "csp.externalScripts" must be a boolean')
    }

    if (options.csp.externalStyles !== undefined && typeof options.csp.externalStyles !== 'boolean') {
      throw new CoraliteError('Config property "csp.externalStyles" must be a boolean')
    }

    if (options.csp.directives !== undefined && (typeof options.csp.directives !== 'object' || options.csp.directives === null)) {
      throw new CoraliteError('Config property "csp.directives" must be an object')
    }
  }

  // Validate testing config
  if (options.testing !== undefined) {
    if (typeof options.testing !== 'object' || options.testing === null) {
      throw new CoraliteError('Config property "testing" must be an object')
    }

    if (options.testing.mocks !== undefined) {
      if (typeof options.testing.mocks !== 'object' || options.testing.mocks === null) {
        throw new CoraliteError('Config property "testing.mocks" must be an object')
      }

      const validMocksKeys = ['components', 'plugins']
      for (const key of Object.keys(options.testing.mocks)) {
        if (!validMocksKeys.includes(key)) {
          throw new CoraliteError(`Invalid key "${key}" in testing.mocks. Valid keys are: ${validMocksKeys.join(', ')}`)
        }
      }

      if (options.testing.mocks.components !== undefined) {
        if (typeof options.testing.mocks.components !== 'object' || options.testing.mocks.components === null) {
          throw new CoraliteError('Config property "testing.mocks.components" must be an object')
        }
        for (const [key, mock] of Object.entries(options.testing.mocks.components)) {
          if (typeof mock !== 'object' || mock === null) {
            throw new CoraliteError(`Mock for component "${key}" must be an object`)
          }
          if (mock.server !== undefined && typeof mock.server !== 'function') {
            throw new CoraliteError(`Mock server for component "${key}" must be a function`)
          }
        }
      }

      if (options.testing.mocks.plugins !== undefined) {
        if (typeof options.testing.mocks.plugins !== 'object' || options.testing.mocks.plugins === null) {
          throw new CoraliteError('Config property "testing.mocks.plugins" must be an object')
        }
        for (const [key, mock] of Object.entries(options.testing.mocks.plugins)) {
          if (typeof mock !== 'object' || mock === null) {
            throw new CoraliteError(`Mock for plugin "${key}" must be an object`)
          }
          if (mock.server !== undefined) {
            if (typeof mock.server !== 'object' || mock.server === null) {
              throw new CoraliteError(`Mock server for plugin "${key}" must be an object`)
            }
            if (mock.server.context !== undefined && (typeof mock.server.context !== 'object' || mock.server.context === null)) {
              throw new CoraliteError(`Mock server context for plugin "${key}" must be an object`)
            }
          }
          if (mock.client !== undefined) {
            if (typeof mock.client !== 'object' || mock.client === null) {
              throw new CoraliteError(`Mock client for plugin "${key}" must be an object`)
            }
            if (mock.client.context !== undefined && (typeof mock.client.context !== 'object' || mock.client.context === null)) {
              throw new CoraliteError(`Mock client context for plugin "${key}" must be an object`)
            }
          }
        }
      }
    }
  }

  // Validate optional plugins property
  if ('plugins' in options && options.plugins !== undefined) {
    if (!Array.isArray(options.plugins)) {
      throw new CoraliteError(
        `Config property "plugins" must be an array, received ${typeof options.plugins}`
      )
    }

    // Validate each plugin in the array
    options.plugins.forEach((plugin, index) => {
      if (typeof plugin !== 'object' || plugin === null) {
        throw new CoraliteError(
          `Plugin at index ${index} must be an object, received ${typeof plugin}`
        )
      }

      if (typeof plugin.name !== 'string' || plugin.name.trim() === '') {
        throw new CoraliteError(
          `Plugin at index ${index} must have a valid "name" property (non-empty string)`
        )
      }
    })
  }

  return options
}
