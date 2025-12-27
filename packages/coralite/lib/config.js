/**
 * @import {CoraliteConfig} from '../types/index.js'
 */

/**
 * Validates and defines a Coralite configuration object
 * @params {CoraliteConfig} options
 * @returns {CoraliteConfig} The validated configuration object
 * @throws {Error} If the configuration is invalid
 */
export function defineConfig (options) {
  // Validate that options is an object
  if (!options || typeof options !== 'object') {
    throw new Error('Config must be an object')
  }

  // Validate required string properties
  const requiredProps = ['output', 'templates', 'pages']

  for (const prop of requiredProps) {
    // Check if property exists
    if (!(prop in options)) {
      throw new Error(`Missing required config property: "${prop}"`)
    }

    // Check if property is a string
    if (typeof options[prop] !== 'string') {
      throw new Error(
        `Config property "${prop}" must be a string, received ${typeof options[prop]}`
      )
    }

    // Check if property is not empty
    if (options[prop].trim() === '') {
      throw new Error(`Config property "${prop}" cannot be empty`)
    }
  }

  // Validate optional plugins property
  if ('plugins' in options && options.plugins !== undefined) {
    if (!Array.isArray(options.plugins)) {
      throw new Error(
        `Config property "plugins" must be an array, received ${typeof options.plugins}`
      )
    }

    // Validate each plugin in the array
    options.plugins.forEach((plugin, index) => {
      if (typeof plugin !== 'object' || plugin === null) {
        throw new Error(
          `Plugin at index ${index} must be an object, received ${typeof plugin}`
        )
      }

      if (typeof plugin.name !== 'string' || plugin.name.trim() === '') {
        throw new Error(
          `Plugin at index ${index} must have a valid "name" property (non-empty string)`
        )
      }
    })
  }

  return options
}
