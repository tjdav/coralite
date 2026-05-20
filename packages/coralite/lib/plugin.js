/**
 * @import { CoralitePlugin, HTMLData } from '../types/index.js'
 */

import { basename, dirname } from 'path'

/**
 * Validates that a value is a non-empty string
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is not a valid non-empty string
 */
function validateNonEmptyString (value, paramName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Coralite plugin validation failed: "${paramName}" must be a non-empty string, received ${typeof value}`
    )
  }
}

/**
 * Validates that a value is a function (or undefined/null)
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is defined but not a function
 */
function validateOptionalFunction (value, paramName) {
  if (value != null && typeof value !== 'function') {
    throw new Error(
      `Coralite plugin validation failed: "${paramName}" must be a function, received ${typeof value}`
    )
  }
}

/**
 * Validates that a value is an array of strings (or empty array)
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is defined but not an array of strings
 */
function validateStringArray (value, paramName) {
  if (!Array.isArray(value)) {
    throw new Error(
      `Coralite plugin validation failed: "${paramName}" must be an array, received ${typeof value}`
    )
  }

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}]" must be a string, received ${typeof value[i]}`
      )
    }
  }
}

/**
 * Processes a single components file with optional caching
 * @param {string} path - Template file path
 * @returns {HTMLData} Template data
 * @throws {Error} If components file cannot be read or is invalid
 */
function processComponents (path) {
  try {
    const componentData = {
      path: {
        pathname: path,
        dirname: dirname(path),
        filename: basename(path)
      }
    }

    return componentData
  } catch (error) {
    throw new Error(
      `Coralite plugin component processing failed for "${path}": ${error.message}`
    )
  }
}

/**
 * Creates a new Coralite plugin instance based on provided configuration options.
 * @param {CoralitePlugin & { components?: string[] }} options - Plugin configuration object
 * @returns {CoralitePlugin & { components: HTMLData[] }} A configured plugin instance ready to be registered with Coralite
 * @example
 * // Basic plugin
 * const myPlugin = definePlugin({
 *   name: 'my-plugin',
 *   exports: {
 *     getData: (context) => (options) => {
 *       // Plugin logic implementation
 *       return { ...context.state, custom: 'data', ...options }
 *     }
 *   }
 * })
 *
 * @example
 * // Plugin with components and metadata
 * const advancedPlugin = definePlugin({
 *   name: 'advanced-plugin',
 *   exports: {
 *     process: (context) => async (options) => {
 *       // Async plugin logic
 *       return { ...context.state, processed: true, ...options }
 *     }
 *   },
 *   components: ['src/components/header.html', 'src/components/footer.html'],
 *   onPageSet: async (data) => {
 *     console.log('Page created:', data.path.pathname)
 *   }
 * })
 *
 * @example
 * // Plugin with caching disabled
 * const devPlugin = definePlugin({
 *   name: 'dev-plugin',
 *   exports: {
 *     getValues: (context) => () => context.state
 *   },
 *   components: ['src/components/dev.html'],
 * })
 */
export function definePlugin ({
  name,
  exports,
  onPageSet,
  onPageUpdate,
  onPageDelete,
  onComponentSet,
  onComponentUpdate,
  onComponentDelete,
  onBeforePageRender,
  onAfterPageRender,
  onBeforeBuild,
  onAfterBuild,
  client,
  server,
  components
}) {
  // Validate required parameters

  let callerDir
  if (client != null && client.rootDir == null) {
    const stack = new Error().stack
    if (stack) {
      const callerLine = stack.split('\n')[2]
      if (callerLine) {
        const match = callerLine.match(/file:\/\/(.+?):/)
        if (match) {
          callerDir = dirname(match[1])
        }
      }
    }
  }

  validateNonEmptyString(name, 'name')

  // Validate optional parameters
  validateOptionalFunction(onPageSet, 'onPageSet')
  validateOptionalFunction(onPageUpdate, 'onPageUpdate')
  validateOptionalFunction(onPageDelete, 'onPageDelete')
  validateOptionalFunction(onComponentSet, 'onComponentSet')
  validateOptionalFunction(onComponentUpdate, 'onComponentUpdate')
  validateOptionalFunction(onComponentDelete, 'onComponentDelete')
  validateOptionalFunction(onBeforePageRender, 'onBeforePageRender')
  validateOptionalFunction(onAfterPageRender, 'onAfterPageRender')
  validateOptionalFunction(onBeforeBuild, 'onBeforeBuild')
  validateOptionalFunction(onAfterBuild, 'onAfterBuild')
  validateOptionalFunction(server, 'server')

  // Validate client plugin if provided
  if (client != null) {
    if (typeof client !== 'object') {
      throw new Error(
        `Coralite plugin validation failed: "client" must be an object, received ${typeof client}`
      )
    }

    // Validate optional client state
    if (client.setup != null && typeof client.setup !== 'function') {
      throw new Error(
        `Coralite plugin validation failed: "client.setup" must be a function, received ${typeof client.setup}`
      )
    }

    if (client.config != null && typeof client.config !== 'object') {
      throw new Error(
        `Coralite plugin validation failed: "client.config" must be an object, received ${typeof client.config}`
      )
    }

    // append rootDir
    client.rootDir = client.rootDir || callerDir
  }

  // Process component files with error handling
  /** @type {HTMLData[]} */
  const componentHTMLData = []

  // Validate components
  if (components) {
    validateStringArray(components, 'components')

    if (components.length > 0) {
      try {
        // Process all components
        for (const path of components) {
          componentHTMLData.push(processComponents(path))
        }
      } catch (error) {
        // Enhance error message with plugin context
        throw new Error(
          `Coralite plugin "${name}" failed to load components: ${error.message}`
        )
      }
    }
  }

  // Create the plugin object with all configured state
  return {
    name,
    exports,
    onPageSet,
    onPageUpdate,
    onPageDelete,
    onComponentSet,
    onComponentUpdate,
    onComponentDelete,
    onBeforePageRender,
    onAfterPageRender,
    onBeforeBuild,
    onAfterBuild,
    components: componentHTMLData,
    client,
    server
  }
}
