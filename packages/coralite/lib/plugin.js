/**
 * @import Coralite from './coralite.js'
 * @import { CoralitePlugin, CoralitePluginResult, HTMLData, CoralitePluginPageSetCallback, CoralitePluginPageUpdateCallback, CoralitePluginPageDeleteCallback, CoralitePluginTemplateCallback, CoralitePluginBeforePageRenderCallback, CoralitePluginBeforeBuildCallback } from '../types/index.js'
 */

import { basename, dirname } from 'path'
import { getHtmlFileSync } from './html.js'

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
 * Validates that a value is an array of Import Objects
 * @param {*} value - Value to validate
 * @param {string} paramName - Parameter name for error messages
 * @throws {Error} If value is defined but not an array of objects
 */
function validateImportArray (value, paramName) {
  if (!Array.isArray(value)) {
    throw new Error(
      `Coralite plugin validation failed: "${paramName}" must be an array, received ${typeof value}`
    )
  }

  for (let i = 0; i < value.length; i++) {
    const item = value[i]

    if (typeof item !== 'object') {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}]" must be an object, received ${typeof item}`
      )
    }

    if (typeof item.specifier !== 'string' || item.specifier.trim().length === 0) {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}].specifier" must be a non-empty string`
      )
    }

    if (item.defaultExport != null && typeof item.defaultExport !== 'string') {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}].defaultExport" must be a string`
      )
    }

    if (item.namedExports != null && !Array.isArray(item.namedExports)) {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}].namedExports" must be an array`
      )
    }

    if (item.attributes != null && typeof item.attributes !== 'object') {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}].attributes" must be an object`
      )
    }

    if (item.namespaceExport != null && typeof item.namespaceExport !== 'string') {
      throw new Error(
        `Coralite plugin validation failed: "${paramName}[${i}].namespaceExport" must be a string`
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
    const content = getHtmlFileSync(path)
    const componentData = {
      content,
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
 * @template T
 * @param {CoralitePlugin<T> & ThisType<Coralite> & { components?: string[] }} options - Plugin configuration object
 * @returns {CoralitePlugin<T> & { components: HTMLData[] }} A configured plugin instance ready to be registered with Coralite
 * @example
 * // Basic plugin
 * const myPlugin = createPlugin({
 *   name: 'my-plugin',
 *   method: (options, context) => {
 *     // Plugin logic implementation
 *     return { ...context.values, custom: 'data' }
 *   }
 * })
 *
 * @example
 * // Plugin with components and metadata
 * const advancedPlugin = createPlugin({
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
 * const devPlugin = createPlugin({
 *   name: 'dev-plugin',
 *   method: (options, context) => context.values,
 *   components: ['src/components/dev.html'],
 * })
 */
export function createPlugin ({
  name,
  method,
  components = [],
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

  // Validate components
  validateStringArray(components, 'components')

  // Validate client plugin if provided
  if (client != null) {
    if (typeof client !== 'object') {
      throw new Error(
        `Coralite plugin validation failed: "client" must be an object, received ${typeof client}`
      )
    }

    let innerClient = client
    // @ts-ignore
    if (client.client && typeof client.client === 'object') {
      // @ts-ignore
      innerClient = client.client
    }

    // Validate optional client properties
    // @ts-ignore
    if (innerClient.setup != null && typeof innerClient.setup !== 'function') {
      throw new Error(
        // @ts-ignore
        `Coralite plugin validation failed: "client.setup" must be a function, received ${typeof innerClient.setup}`
      )
    }

    // @ts-ignore
    if (innerClient.helpers != null && typeof innerClient.helpers !== 'object') {
      throw new Error(
        // @ts-ignore
        `Coralite plugin validation failed: "client.helpers" must be an object, received ${typeof innerClient.helpers}`
      )
    }

    // @ts-ignore
    if (innerClient.imports != null) {
      // @ts-ignore
      validateImportArray(innerClient.imports, 'client.imports')
    }

    // @ts-ignore
    if (innerClient.config != null && typeof innerClient.config !== 'object') {
      throw new Error(
        // @ts-ignore
        `Coralite plugin validation failed: "client.config" must be an object, received ${typeof innerClient.config}`
      )
    }

    // Normalize to flat client format internally for backward compatibility with build scripts
    // @ts-ignore
    if (client.client && typeof client.client === 'object') {
      // @ts-ignore
      client.setup = client.client.setup
      // @ts-ignore
      client.helpers = client.client.helpers
      // @ts-ignore
      client.imports = client.client.imports
      // @ts-ignore
      client.config = client.client.config
      // @ts-ignore
      client.components = client.client.components
    }
  }

  // Process component files with error handling
  /** @type {HTMLData[]} */
  const componentHTMLData = []

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

  // Create the plugin object with all configured properties
  return {
    name,
    method,
    components: componentHTMLData,
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

