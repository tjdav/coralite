/**
 * @import Coralite from './coralite.js'
 * @import { CoralitePlugin, CoralitePluginResult, HTMLData, CoralitePluginPageSetCallback, CoralitePluginPageUpdateCallback, CoralitePluginPageDeleteCallback, CoralitePluginTemplateCallback, CoralitePluginBeforePageRenderCallback, CoralitePluginBeforeBuildCallback } from '../types/index.js'
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
 * Creates a new Coralite plugin instance based on provided configuration options.
 * @template T
 * @param {CoralitePlugin<T> & ThisType<Coralite>} options - Plugin configuration object
 * @returns {CoralitePlugin<T>} A configured plugin instance ready to be registered with Coralite
 * @example
 * // Basic plugin
 * const myPlugin = definePlugin({
 *   name: 'my-plugin',
 *   method: (options, context) => {
 *     // Plugin logic implementation
 *     return { ...context.values, custom: 'data' }
 *   }
 * })
 *
 * @example
 * // Plugin with components and metadata
 * const advancedPlugin = definePlugin({
 *   name: 'advanced-plugin',
 *   method: async (options, context) => {
 *     // Async plugin logic
 *     return { ...context.values, processed: true }
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
 *   method: (options, context) => context.values,
 *   components: ['src/components/dev.html'],
 * })
 */
export function definePlugin ({
  name,
  method,
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
  server
}) {
  // Validate required parameters
  validateNonEmptyString(name, 'name')

  // Validate optional parameters
  validateOptionalFunction(method, 'method')
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

    // Validate optional client properties
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
  }

  // Process component files with error handling
  /** @type {HTMLData[]} */
  const componentHTMLData = []
  // Create the plugin object with all configured properties
  return {
    name,
    method,
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
    server
  }
}
